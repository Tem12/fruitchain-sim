import { Command } from 'commander';
import Simulator from './src/Simulator';
import 'source-map-support/register';
import { writeFileSync } from 'fs';

const program = new Command();

program.name('fruitchain-automated').description('Fruitchain Automated Typescript implementation').version('1.0.0');
program.option('-o, --out <string>', 'csv data output path');
program.parse();

const SIM_REPEAT = 5;

let csvContent = '';

// Append header to csv
csvContent += 'selfish_miner_power,profit\n';

// Append data for situation when selfish has zero mining power
csvContent += '0,0\n';

for (let j = 0; j < 50; j += 10) {
    for (let i = 1; i < 51; i++) {
        const config = {
            consensus_name: 'Fruitchain',
            miners: { honest: { mining_power: 100 - i - j }, selfish: [{ mining_power: i }, {mining_power: j / 2}, {mining_power: j / 2}] },
            gamma: 0.5,
            simulation_mining_rounds: 1000,
            fruit_mine_prob: 0.9,
            superblock_prob: 0.1,
            log_output: false,
        };

        let selfishResult = 0;
        console.log(`${j},${i}`);
        for (let j = 0; j < SIM_REPEAT; j++) {
            // console.log(config);

            const simulator = new Simulator(config);
            const results = simulator.simulate();

            // console.log(results[1]);
            selfishResult += results[1];
        }

        csvContent += `${i},${selfishResult / SIM_REPEAT}\n`;
    }
}

// Write data into csv
try {
    writeFileSync(program.opts().out, csvContent);
} catch (err) {
    console.error(err);
}
