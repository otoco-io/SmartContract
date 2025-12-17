const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("OtoCo Master Test", function () {

  let owner, wallet2, wallet3, wallet4;
  let OtoCoMaster;
  let otocoMaster;
  let jurisdictions;

  const zeroAddress = ethers.constants.AddressZero;

  it("Create Jurisdictions", async function () {

    [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const Unincorporated = await ethers.getContractFactory("JurisdictionUnincorporated");
    const Delaware = await ethers.getContractFactory("JurisdictionDelaware");
    const Wyoming = await ethers.getContractFactory("JurisdictionWyoming");

    const unincorporated = await Unincorporated.deploy('DAO', 'defaultBadgeURL', 'goldBadgeURL');
    const delaware = await Delaware.deploy('DELAWARE', 'defaultBadgeURLDE', 'goldBadgeURLDE');
    const wyoming = await Wyoming.deploy('WYOMING', 'defaultBadgeURLWY', 'goldBadgeURLWY');

    jurisdictions = [unincorporated.address, delaware.address, wyoming.address];
  });

  it("Initialize Master and add jurisdictions", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    OtoCoMaster = await ethers.getContractFactory("OtoCoMaster");
    otocoMaster = await upgrades.deployProxy(OtoCoMaster, [jurisdictions, 'https://otoco.io/dashpanel/entity/']);
    await otocoMaster.deployed();

    expect(await otocoMaster.name()).to.equal("OtoCo Series");
    expect(await otocoMaster.symbol()).to.equal("OTOCO");
    expect(await otocoMaster.owner()).to.equal(owner.address);
  });

  it("Check jurisdiction order and count", async function () {

    const unincorporated = await ethers.getContractAt("OtoCoJurisdiction", await otocoMaster.jurisdictionAddress(0));
    const delaware = await ethers.getContractAt("OtoCoJurisdiction", await otocoMaster.jurisdictionAddress(1));
    const wyoming = await ethers.getContractAt("OtoCoJurisdiction", await otocoMaster.jurisdictionAddress(2));

    expect(await otocoMaster.jurisdictionCount()).to.equal(3);

    expect(await unincorporated.getJurisdictionName()).to.equal("DAO");
    expect(await delaware.getJurisdictionName()).to.equal("DELAWARE");
    expect(await wyoming.getJurisdictionName()).to.equal("WYOMING");

  });

  it("Test migration of previous entities", async function () {

    const jurisdictions = [0, 1, 2];
    const controllers = [wallet2.address, wallet3.address, wallet4.address];
    const creations = [10000, 20000, 30000];
    const names = ['Entity 1', 'Entity 2 LLC', 'Entity 3 - Series 1'];

    await otocoMaster.createBatchSeries(jurisdictions, controllers, creations, names);


    expect((await otocoMaster.seriesCount()).toNumber()).to.equal(3);

    const firstSeries = await otocoMaster.series(0);
    expect(firstSeries[0]).to.equal(0);
    expect(firstSeries[2].toNumber()).to.equal(10000);
    expect(firstSeries[3]).to.equal("Entity 1");

    const secondSeries = await otocoMaster.series(1);
    expect(secondSeries[0]).to.equal(1);
    expect(secondSeries[2].toNumber()).to.equal(20000);
    expect(secondSeries[3]).to.equal("Entity 2 LLC");

    await expect(otocoMaster.connect(wallet3).createBatchSeries(jurisdictions, controllers, creations, names)).to.be.revertedWith("Ownable: caller is not the owner");

  });

  it("Test migration entities", async function () {

    const jurisdictions = [2, 2, 2, 1];
    const controllers = [wallet2.address, wallet3.address, wallet4.address, zeroAddress];
    const creations = [10000, 20000, 30000, 40000];
    const names = ['Entity 1 - Series 2', 'Entity 2 - Series 3', 'Entity 3 - Series 4', 'Closed LLC'];

    await otocoMaster.createBatchSeries(jurisdictions, controllers, creations, names);

    expect((await otocoMaster.seriesCount()).toNumber()).to.equal(7);

    const firstSeries = await otocoMaster.series(3);
    expect(firstSeries[0]).to.equal(2);
    expect(firstSeries[2].toNumber()).to.equal(10000);
    expect(firstSeries[3]).to.equal("Entity 1 - Series 2");

    const secondSeries = await otocoMaster.series(4);
    expect(secondSeries[0]).to.equal(2);
    expect(secondSeries[2].toNumber()).to.equal(20000);
    expect(secondSeries[3]).to.equal("Entity 2 - Series 3");

  });

  it("Check if rejections when migrate are triggered", async function () {

    let jurisdictions = [];
    let controllers = [];
    let creations = [];
    let names = [];

    await expect(otocoMaster.connect(wallet2).createBatchSeries(jurisdictions, controllers, creations, names))
      .to.be.revertedWith('Ownable: caller is not the owner');

    jurisdictions = [2];

    await expect(otocoMaster.createBatchSeries(jurisdictions, controllers, creations, names))
      .to.be.revertedWith('OtoCoMaster: Owner and Jurisdiction array should have same size.');

    jurisdictions = [2];
    controllers = [wallet2.address];

    await expect(otocoMaster.createBatchSeries(jurisdictions, controllers, creations, names))
      .to.be.revertedWith('OtoCoMaster: Name and Controller array should have same size.');

    jurisdictions = [2];
    controllers = [wallet2.address];
    names = ['Test Name']

    await expect(otocoMaster.createBatchSeries(jurisdictions, controllers, creations, names))
      .to.be.revertedWith('OtoCoMaster: Controller and Creation array should have same size.');

    jurisdictions = new Array(256).fill(0);
    controllers = new Array(256).fill(owner.address);
    names = new Array(256).fill('Test Name');
    creations = new Array(256).fill(1000);

    await expect(otocoMaster.createBatchSeries(jurisdictions, controllers, creations, names))
      .to.be.revertedWith('OtoCoMaster: Not allowed to migrate more than 255 entities at once.');

  });

  it("Creating series with correct fees and wrong fees", async function () {

    const gasPrice = ethers.BigNumber.from("10000000000");
    const gasLimit = ethers.BigNumber.from("150000");
    const otocoBaseFee = await otocoMaster.baseFee();

    // 34750 reduction from gas limit is what is spended before check happens
    const amountToPayForSpinUp = ethers.BigNumber.from(gasPrice).mul(gasLimit.sub(34750)).div(otocoBaseFee);
    // Remove 1% from the correct amount needed
    const notEnoughToPayForSpinUp = amountToPayForSpinUp.mul(100).div(101);

    // Try to create without the proper amount of ETH Value, expect to fail
    await expect(otocoMaster.createSeries(2, owner.address, "New Entity", { gasPrice, gasLimit, value: notEnoughToPayForSpinUp }))
      .to.be.revertedWith('OtoCoMaster: Not enough ETH paid for the execution.');

    // Expected to successfully create a new entity
    const transaction = await otocoMaster.createSeries(2, owner.address, "New Entity", { gasPrice, gasLimit, value: amountToPayForSpinUp });
    await expect(transaction).to.emit(otocoMaster, 'Transfer').withArgs(zeroAddress, owner.address, 7);
    expect((await otocoMaster.series(7)).jurisdiction).to.be.equal(2)
    expect((await otocoMaster.series(7)).name).to.be.equal("New Entity - Series 5")

    // Check if the amount to pay was transferred
    expect(await ethers.provider.getBalance(otocoMaster.address)).to.be.equal(amountToPayForSpinUp);

  });

  it("Closing series with correct fees and wrong fees", async function () {

    const gasPrice = ethers.BigNumber.from("10000000000");
    const gasLimit = ethers.BigNumber.from("60000");
    const otocoBaseFee = await otocoMaster.baseFee();

    // 34750 reduction from gas limit is what is spended before check happens
    const amountToPayForClose = ethers.BigNumber.from(gasPrice).mul(gasLimit.sub(31000)).div(otocoBaseFee);
    // Remove 1% from the correct amount needed
    const notEnoughToPayForClose = amountToPayForClose.mul(100).div(104);

    await expect(otocoMaster.closeSeries(6, { gasPrice, gasLimit, value: notEnoughToPayForClose }))
      .to.be.revertedWith('OtoCoMaster: Not enough ETH paid for the execution.');

    await expect(otocoMaster.connect(wallet2).closeSeries(7, { gasPrice, gasLimit, value: amountToPayForClose }))
      .to.be.revertedWith('OtoCoMaster: Series close from incorrect owner');

    // Close the company
    const transactionClose = await otocoMaster.closeSeries(7, { gasPrice, gasLimit, value: amountToPayForClose });
    await expect(transactionClose).to.emit(otocoMaster, 'Transfer').withArgs(owner.address, zeroAddress, 7);

    await expect(otocoMaster.ownerOf(6)).to.be.reverted

  });

  it("Add new and update jurisdiction", async function () {

    const Unincorporated = await ethers.getContractFactory("JurisdictionUnincorporated");
    const unincorporated2 = await Unincorporated.deploy('DAO2', 'defaultBadgeURL', 'goldBadgeURL');
    const unincorporated3 = await Unincorporated.deploy('DAO3', 'defaultBadgeURL', 'goldBadgeURL');

    // Try add with wrong wallet
    await expect(otocoMaster.connect(wallet2).addJurisdiction(unincorporated2.address))
      .to.be.revertedWith('Ownable: caller is not the owner');

    await otocoMaster.addJurisdiction(unincorporated2.address)

    expect(await otocoMaster.jurisdictionCount()).to.be.equal(4);
    expect(await otocoMaster.jurisdictionAddress(3)).to.be.equals(unincorporated2.address);

    // Try update with wrong wallet
    await expect(otocoMaster.connect(wallet2).updateJurisdiction(3, unincorporated3.address))
      .to.be.revertedWith('Ownable: caller is not the owner');

    await otocoMaster.updateJurisdiction(3, unincorporated3.address);

    expect(await otocoMaster.jurisdictionCount()).to.be.equal(4);
    expect(await otocoMaster.jurisdictionAddress(3)).to.be.equals(unincorporated3.address);

  });

  it("Change and withdraw fees", async function () {

    // Try add with wrong wallet
    await expect(otocoMaster.connect(wallet2).changeBaseFees(20))
      .to.be.revertedWith('Ownable: caller is not the owner');

    await otocoMaster.changeBaseFees(20)

    expect(await otocoMaster.baseFee()).to.be.equal(20);

    // Try update with wrong wallet
    await expect(otocoMaster.connect(wallet2).withdrawFees())
      .to.be.revertedWith('Ownable: caller is not the owner');

    await otocoMaster.withdrawFees();

    // Check if the amount to pay was transferred
    expect(await ethers.provider.getBalance(otocoMaster.address)).to.be.equal(0);

  });

  it("Check tokenURI format and structure", async function () {

    const tokenURI = await otocoMaster.tokenURI(4);
    const tokenURI2 = await otocoMaster.tokenURI(0);

    // Verify URI starts with correct data URL scheme
    expect(tokenURI).to.include('data:application/json;base64,');
    expect(tokenURI2).to.include('data:application/json;base64,');

    // Decode base64 data to read JSON data
    let buff = Buffer.from(tokenURI.split(',')[1], 'base64');
    let json = JSON.parse(buff.toString('utf-8'));

    // Verify migrated entity (tokenId < lastMigrated) has gold badge
    expect(json.name).to.be.equal("Entity 2 - Series 3");
    expect(json.image).to.be.equal("goldBadgeURLWY");
    expect(json.description).to.include("OtoCo NFTs are minted to represent each entity");
    expect(json.description).to.include("Entity 2 - Series 3");
    expect(json.description).to.include("https://otoco.io");
    expect(json.external_url).to.include("https://otoco.io/dashpanel/entity/");
    expect(json.external_url).to.include("4/");

    // Verify attributes array structure
    expect(json.attributes).to.be.an('array');
    expect(json.attributes).to.have.lengthOf(2);

    // Verify creation date attribute
    expect(json.attributes[0].display_type).to.be.equal("date");
    expect(json.attributes[0].trait_type).to.be.equal("Creation");
    expect(json.attributes[0].value).to.be.equal("20000");

    // Verify jurisdiction attribute
    expect(json.attributes[1].trait_type).to.be.equal("Jurisdiction");
    expect(json.attributes[1].value).to.be.equals("WYOMING");

    // Decode base64 data for first migrated entity
    buff = Buffer.from(tokenURI2.split(',')[1], 'base64');
    json = JSON.parse(buff.toString('utf-8'));

    // Verify entity name and badge
    expect(json.name).to.be.equal("Entity 1");
    expect(json.image).to.be.equal("goldBadgeURL");
    expect(json.external_url).to.include("0/");
    expect(json.attributes[0].trait_type).to.be.equal("Creation");
    expect(json.attributes[0].value).to.be.equal("10000");
    expect(json.attributes[1].trait_type).to.be.equal("Jurisdiction");
    expect(json.attributes[1].value).to.be.equals("DAO");
  });

  it("Check tokenURI with different jurisdictions", async function () {

    // Test entity with Unincorporated jurisdiction (index 0)
    const tokenURI0 = await otocoMaster.tokenURI(0);
    let buff = Buffer.from(tokenURI0.split(',')[1], 'base64');
    let json = JSON.parse(buff.toString('utf-8'));

    expect(json.name).to.be.equal("Entity 1");
    expect(json.image).to.be.equal("goldBadgeURL"); // Unincorporated gold badge
    expect(json.attributes[1].value).to.be.equals("DAO");
    expect(json.external_url).to.include("https://otoco.io/dashpanel/entity/0/");

    // Test entity with Delaware jurisdiction (index 1)
    const tokenURI1 = await otocoMaster.tokenURI(1);
    buff = Buffer.from(tokenURI1.split(',')[1], 'base64');
    json = JSON.parse(buff.toString('utf-8'));

    expect(json.name).to.be.equal("Entity 2 LLC");
    expect(json.image).to.be.equal("goldBadgeURLDE"); // Delaware gold badge
    expect(json.attributes[1].value).to.be.equals("DELAWARE");
    expect(json.external_url).to.include("https://otoco.io/dashpanel/entity/1/");

    // Test entity with Wyoming jurisdiction (index 2)
    const tokenURI2 = await otocoMaster.tokenURI(2);
    buff = Buffer.from(tokenURI2.split(',')[1], 'base64');
    json = JSON.parse(buff.toString('utf-8'));

    expect(json.name).to.be.equal("Entity 3 - Series 1");
    expect(json.image).to.be.equal("goldBadgeURLWY"); // Wyoming gold badge
    expect(json.attributes[1].value).to.be.equals("WYOMING");
    expect(json.external_url).to.include("https://otoco.io/dashpanel/entity/2/");
  });

  it("Check tokenURI for migrated vs new entities badge differences", async function () {

    // All entities before lastMigrated should have gold badges
    const tokenURI0 = await otocoMaster.tokenURI(0);
    const tokenURI1 = await otocoMaster.tokenURI(1);
    const tokenURI2 = await otocoMaster.tokenURI(2);
    const tokenURI3 = await otocoMaster.tokenURI(3);
    const tokenURI4 = await otocoMaster.tokenURI(4);
    const tokenURI5 = await otocoMaster.tokenURI(5);
    const tokenURI6 = await otocoMaster.tokenURI(6);

    // Verify all migrated entities have gold badges
    let buff = Buffer.from(tokenURI0.split(',')[1], 'base64');
    let json = JSON.parse(buff.toString('utf-8'));
    expect(json.image).to.be.equal("goldBadgeURL");

    buff = Buffer.from(tokenURI1.split(',')[1], 'base64');
    json = JSON.parse(buff.toString('utf-8'));
    expect(json.image).to.be.equal("goldBadgeURLDE");

    buff = Buffer.from(tokenURI2.split(',')[1], 'base64');
    json = JSON.parse(buff.toString('utf-8'));
    expect(json.image).to.be.equal("goldBadgeURLWY");

    buff = Buffer.from(tokenURI3.split(',')[1], 'base64');
    json = JSON.parse(buff.toString('utf-8'));
    expect(json.image).to.be.equal("goldBadgeURLWY");

    buff = Buffer.from(tokenURI4.split(',')[1], 'base64');
    json = JSON.parse(buff.toString('utf-8'));
    expect(json.image).to.be.equal("goldBadgeURLWY");

    buff = Buffer.from(tokenURI5.split(',')[1], 'base64');
    json = JSON.parse(buff.toString('utf-8'));
    expect(json.image).to.be.equal("goldBadgeURLWY");

    buff = Buffer.from(tokenURI6.split(',')[1], 'base64');
    json = JSON.parse(buff.toString('utf-8'));
    expect(json.image).to.be.equal("goldBadgeURLDE");

    // Note: lastMigrated is internal, but we've verified its behavior through badge checks
    // All 7 entities created via createBatchSeries should have gold badges
  });

  it("Check tokenURI validates all required JSON fields", async function () {

    const tokenURI = await otocoMaster.tokenURI(4);
    const buff = Buffer.from(tokenURI.split(',')[1], 'base64');
    const json = JSON.parse(buff.toString('utf-8'));

    // Verify all required NFT metadata fields exist
    expect(json).to.have.property('name');
    expect(json).to.have.property('description');
    expect(json).to.have.property('image');
    expect(json).to.have.property('external_url');
    expect(json).to.have.property('attributes');

    // Verify field types
    expect(json.name).to.be.a('string');
    expect(json.description).to.be.a('string');
    expect(json.image).to.be.a('string');
    expect(json.external_url).to.be.a('string');
    expect(json.attributes).to.be.an('array');

    // Verify description contains required text
    expect(json.description).to.include("OtoCo NFTs");
    expect(json.description).to.include("holder of this NFT");
    expect(json.description).to.include(json.name);
    expect(json.description).to.include("https://otoco.io");

    // Verify attributes have correct structure
    json.attributes.forEach(attr => {
      expect(attr).to.have.property('trait_type');
      expect(attr).to.have.property('value');
      expect(attr.trait_type).to.be.a('string');
      expect(attr.value).to.be.a('string');
    });

    // Verify Creation attribute has display_type
    expect(json.attributes[0]).to.have.property('display_type');
    expect(json.attributes[0].display_type).to.equal('date');

    // Verify external_url format
    expect(json.external_url).to.match(/^https:\/\/otoco\.io\/dashpanel\/entity\/\d+\/$/);
  });

  it("Check tokenURI JSON is valid base64 and parseable", async function () {

    // Test multiple entities to ensure consistent encoding
    const tokenIds = [0, 1, 2, 3, 4, 5, 6];
    
    for (const tokenId of tokenIds) {
      const tokenURI = await otocoMaster.tokenURI(tokenId);
      
      // Verify it starts with the correct data URI scheme
      expect(tokenURI).to.match(/^data:application\/json;base64,/);
      
      // Extract and decode base64
      const base64Data = tokenURI.split(',')[1];
      const buff = Buffer.from(base64Data, 'base64');
      const jsonString = buff.toString('utf-8');
      
      // Parse JSON and verify it doesn't throw
      let json;
      expect(() => {
        json = JSON.parse(jsonString);
      }).to.not.throw();
      
      // Verify essential fields are present
      expect(json).to.have.property('name');
      expect(json).to.have.property('image');
      expect(json).to.have.property('attributes');
      expect(json.attributes).to.be.an('array').with.lengthOf(2);
    }
  });



});