var assert = require('assert');
const { stringify } = require('querystring');
const fs = require('fs');
var t = require('tarantula-fl');

const mochaOutput = require('../../mochaOutput.json');
const testMatrix = require('../../testMatrix.json');


describe('Tarantula', () => {
    describe('tarantulaScore', () => {
        it('should score this input correctly', () => {

            var testData = {
                testResults: t.fromMocha(mochaOutput),
                coverage: t.fromSolCover(testMatrix),
            };

            score = t.tarantulaScore(testData);            
            let output = JSON.stringify(score, undefined, 2);
            
            // for (var filename in score) {
            //     console.log(score[filename]);
            // }
            fs.writeFileSync(`./test/tarantula/output.json`, output, 'utf8');
            
            try {
                const count_0 = (
                    fs
                        .readFileSync(`./test/tarantula/output.json`, 'utf8')
                        .match(/^\s*"suspiciousness": 0$/gm) || []
                ).length;
            
                const count_1 = (
                    fs
                        .readFileSync(`./test/tarantula/output.json`, 'utf8')
                        .match(/^\s*"suspiciousness": 1$/gm) || []
                ).length;
            
                const jsonResult = JSON.stringify([
                    {
                        type: 'suspiciousness_0',
                        count: count_0,
                    },
                    {
                        type: 'suspiciousness_1',
                        count: count_1,
                    },
                ], undefined, 2);
            
                fs.writeFileSync('./test/tarantula/suspiciousness.json', jsonResult, 'utf-8');
            
                // console.log(jsonResult);
            } catch (error) {
                console.error(`Error: ${error.message}`);
            }
            
        });
    });
});