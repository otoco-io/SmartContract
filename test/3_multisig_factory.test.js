const MultisigFactory = artifacts.require('MultisigFactory');

// Start test block
contract('Master Registry Upgrade', (accounts) => {
    before(async function () {
        // Deploy Master Contract
        this.otocorpInstance = await OtoCorp.deployed();
        // Create token Factory
        this.factory = await TokenFactory.deployed();
        console.log('FACTORY ADDRESS:',this.factory.address)
    });

    it('Should Exist First Company', async function () {
        let address = await this.otocorpInstance.mySeries({from:accounts[1]});
        let series = await Series.at(address.toString());
        expect(await series.owner()).to.equal(accounts[1]);
        expect(await series.getName()).to.equal('First Entity');
    });

    it('Throws error trying to transfer ownership from not owner', async function () {
        try {
            await this.factory.transferOwnership(accounts[3], {from:accounts[2]});
        } catch (err) {
            expect(err.reason).to.be.equals('Ownable: caller is not the owner');
        }
    })

    it('Transfer Factory Ownership to Account[2]', async function () {
        await this.factory.transferOwnership(accounts[2]);
        let owner = await this.factory.owner();
        expect(owner).to.equal(accounts[2]);
      });
});