import SelfishMiner from './SelfishMiner';
import HonestMiner from './HonestMiner';
import Miner from './Miner';
import { MinerType } from './types';
const chalk = require('chalk');
const Table = require('cli-table');

export default function weightedRandom(items: any[], weights: number[]) {
    if (items.length !== weights.length) {
        throw new Error('Items and weights must be of the same size');
    }
    if (!items.length) {
        throw new Error('Items must not be empty');
    }
    // Preparing the cumulative weights array.
    // For example:
    // - weights = [1, 4, 3]
    // - cumulativeWeights = [1, 5, 8]
    const cumulativeWeights = [];
    for (let i = 0; i < weights.length; i += 1) {
        cumulativeWeights[i] = weights[i] + (cumulativeWeights[i - 1] || 0);
    }
    // Getting the random number in a range of [0...sum(weights)]
    // For example:
    // - weights = [1, 4, 3]
    // - maxCumulativeWeight = 8
    // - range for the random number is [0...8]
    const maxCumulativeWeight = cumulativeWeights[cumulativeWeights.length - 1];
    const randomNumber = maxCumulativeWeight * Math.random();
    // Picking the random item based on its weight.
    // The items with higher weight will be picked more often.
    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
        if (cumulativeWeights[itemIndex] >= randomNumber) {
            return {
                item: items[itemIndex],
                index: itemIndex,
            };
        }
    }
}

export function printChainsData(newMiner: Miner, honestMiner: HonestMiner, selfishMiner: SelfishMiner) {
    console.log(
        chalk.bold('================================================================================================'),
    );

    if (newMiner.type === MinerType.HONEST) {
        console.log(chalk.bold('Honest') + ' is about to mine a block');
    } else {
        console.log(chalk.bold('Selfish') + ' is about to mine a block');
    }

    console.log('Current state (before new block):');

    const tableMiners = new Table({
        head: ['Miner', '# blocks', 'Last block num', 'i block miner', 'i-1 block miner', 'chainStr', '# mempool fruit'],
    });

    const honestNonIncludedFruit = honestMiner.publicFruitpool.filter(
        (fruit) =>
            fruit.lastBlockNum === honestMiner.chain.lastBlockNum &&
            fruit.lastBlockOwnerId === honestMiner.chain.getLastBlock().ownerId,
    ).length;

    const selfishNonIncludedFruit =
        selfishMiner.publicFruitpool.filter(
            (fruit) =>
                fruit.lastBlockNum === selfishMiner.chain.lastBlockNum &&
                fruit.lastBlockOwnerId === selfishMiner.chain.getLastBlock().ownerId,
        ).length +
        selfishMiner.privateFruitpool.filter(
            (fruit) =>
                fruit.lastBlockNum === selfishMiner.chain.lastBlockNum &&
                fruit.lastBlockOwnerId === selfishMiner.chain.getLastBlock().ownerId,
        ).length;
    tableMiners.push([
        chalk.bold.italic('Honest'),
        honestMiner.chain.blocks.length.toString(),
        honestMiner.chain.lastBlockNum,
        honestMiner.chain.getLastBlock().ownerId === 0 ? 'Honest' : 'Selfish',
        honestMiner.chain.getPenultimateBlock().ownerId === 0 ? 'Honest' : 'Selfish',
        honestMiner.chain.chainStrength.toFixed(2),
        honestNonIncludedFruit.toString(),
    ]);
    tableMiners.push([
        chalk.bold.italic('Selfish'),
        selfishMiner.chain.blocks.length.toString(),
        selfishMiner.chain.lastBlockNum,
        selfishMiner.chain.getLastBlock().ownerId === 0 ? 'Honest' : 'Selfish',
        selfishMiner.chain.getPenultimateBlock().ownerId === 0 ? 'Honest' : 'Selfish',
        selfishMiner.chain.chainStrength.toFixed(2),
        selfishNonIncludedFruit.toString(),
    ]);

    const tableDetails = new Table({
        head: ['Last block identical?', '# of blocks selfish ahead'],
    });
    const lastBlockIdentical =
        honestMiner.chain.blocks.length === selfishMiner.chain.blocks.length &&
        honestMiner.chain.getLastBlock().ownerId === selfishMiner.chain.getLastBlock().ownerId;
    const selfishNumBlocksAhead = selfishMiner.chain.blocks.length - honestMiner.chain.blocks.length;
    tableDetails.push([lastBlockIdentical.toString(), selfishNumBlocksAhead.toString()]);

    console.log(tableMiners.toString());
    console.log(tableDetails.toString());
}

export function printInfo(msg: string) {
    // console.log(msg);
}
