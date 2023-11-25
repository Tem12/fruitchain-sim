import Blockchain from './Blockchain';
import { Block, Fruit, MinerType } from './types';

export default class Miner {
    id: number;
    miningPower: number;
    type: MinerType;
    chain: Blockchain;
    publicFruitpool: Fruit[];
    fruitpoolLastBlockId: number;

    constructor(id: number, miningPower: number, fruitReward: number) {
        this.miningPower = miningPower;

        this.id = id;
        this.miningPower = miningPower;
        this.chain = new Blockchain(this.id, fruitReward);
        this.publicFruitpool = [];
        this.fruitpoolLastBlockId = -1;
    }

    mineBlock(): Block {
        return;
    }

    mineFruit(chainOwnerId: number): Fruit {
        return;
    }

    receiveFruit(fruit: Fruit) {
        return;
    }

    clearFruitPool() {
        return;
    }

    getFruitCount(): number {
        return;
    }

    extendBlockchain(block: Block): void {
        this.chain.extendBlockchain(block);
    }

    overrideBlockchain(fromOverrideBlockchain: Blockchain): void {
        return;
    }
}
