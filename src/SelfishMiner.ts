import Blockchain from './Blockchain';
import Miner from './Miner';
import { Block, Fruit, MinerType } from './types';

export default class SelfishMiner extends Miner {
    privateFruitpool: Fruit[];

    constructor(id: number, miningPower: number, fruitReward: number) {
        super(id, miningPower, fruitReward);
        this.type = MinerType.SELFISH;

        this.privateFruitpool = [];
    }

    mineBlock(): Block {
        // Remove fruits that do not reference correctly to the last block
        this.publicFruitpool = this.publicFruitpool.filter(
            (fruit) =>
                fruit.lastBlockNum === this.chain.lastBlockNum &&
                fruit.lastBlockOwnerId === this.chain.getLastBlock().ownerId,
        );

        this.privateFruitpool = this.privateFruitpool.filter(
            (fruit) =>
                fruit.lastBlockNum === this.chain.lastBlockNum &&
                fruit.lastBlockOwnerId === this.chain.getLastBlock().ownerId,
        );

        const block = this.chain.createBlock(this.publicFruitpool.concat(this.privateFruitpool));

        // Clear fruitpool after creating a block
        this.publicFruitpool = [];
        this.privateFruitpool = [];

        return block;
    }

    mineFruit(chain: Blockchain): Fruit {
        const minedFruit: Fruit = {
            ownerId: this.id,
            lastBlockOwnerId: chain.getLastBlock().ownerId,
            lastBlockNum: chain.lastBlockNum,
        };

        this.privateFruitpool.push(minedFruit);

        return minedFruit;
    }

    receiveFruit(fruit: Fruit) {
        this.publicFruitpool.push(fruit);
    }

    clearFruitPool() {
        this.publicFruitpool = [];
        this.privateFruitpool = [];
    }

    getFruitCount(): number {
        return this.publicFruitpool.length + this.privateFruitpool.length;
    }

    overrideBlockchain(fromOverrideBlockchain: Blockchain): void {
        this.chain.overrideBlockchain(fromOverrideBlockchain);
    }
}
