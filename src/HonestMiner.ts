import Blockchain from './Blockchain';
import Miner from './Miner';
import { Block, Fruit, MinerType } from './types';

export default class HonestMiner extends Miner {
    constructor(id: number, miningPower: number, fruitReward: number) {
        super(id, miningPower, fruitReward);
        this.type = MinerType.HONEST;
    }

    mineBlock(): Block {
        // Remove fruits that do not reference correctly to the last block
        this.publicFruitpool = this.publicFruitpool.filter(
            (fruit) =>
                fruit.lastBlockNum === this.chain.lastBlockNum &&
                fruit.lastBlockOwnerId === this.chain.getLastBlock().ownerId,
        );

        const block = this.chain.createBlock(this.publicFruitpool);

        // Clear fruitpool after creating a block
        this.publicFruitpool = [];

        return block;
    }

    mineFruit(chain: Blockchain): Fruit {
        const minedFruit: Fruit = {
            ownerId: this.id,
            lastBlockOwnerId: chain.getLastBlock().ownerId,
            lastBlockNum: chain.lastBlockNum,
        };

        this.publicFruitpool.push(minedFruit);

        return minedFruit;
    }

    receiveFruit(fruit: Fruit) {
        // Not used
        console.error('Honest miner cannot receive fruits from selfish miners');
        this.publicFruitpool.push(fruit);
    }

    clearFruitPool() {
        this.publicFruitpool = [];
    }

    getFruitCount(): number {
        return this.publicFruitpool.length;
    }

    overrideBlockchain(fromOverrideBlockchain: Blockchain): void {
        this.chain.overrideBlockchain(fromOverrideBlockchain);
    }
}
