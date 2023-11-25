import { Command } from 'commander';
import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import Simulator from './src/Simulator';
import 'source-map-support/register';

const program = new Command();

program.name('fruitchain').description('Fruitchain Typescript implementation').version('1.0.0');
program.option('-c, --config <string>', 'configuration path');
program.parse();

const configPath = program.opts().config;

const file = readFileSync(configPath, 'utf8');
const parsedConfig = parseYaml(file);

console.log(parsedConfig[0]['simulation1']);

const simulator = new Simulator(parsedConfig[0]['simulation1']);
simulator.simulate();
