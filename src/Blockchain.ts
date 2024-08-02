import { Block, Fruit } from './types';

export default class Blockchain {
    ownerId: number;
    blocks: Block[];
    lastBlockNum: number;
    chainStrength: number;
    fruitReward: number;

    constructor(ownerId: number, fruitReward: number) {
        this.ownerId = ownerId;
        this.blocks = [];
        this.lastBlockNum = -1;
        this.chainStrength = 0.0;

        this.fruitReward = fruitReward;
    }

    getLastBlock(): Block {
        return this.blocks[this.blocks.length - 1];
    }

    getPenultimateBlock(): Block {
        if (this.blocks.length > 1) {
            return this.blocks[this.blocks.length - 2];
        }
        return this.blocks[this.blocks.length - 1];
    }

    createBlock(fruit: Fruit[]): Block {
        const block: Block = {
            ownerId: this.ownerId,
            fruit: fruit,
        };
        return block;
    }

    extendBlockchain(block: Block) {
        // Append a new block at the end of the blockchain
        this.blocks.push(block);
        this.lastBlockNum++;

        // Update chain strength by block difficulty
        this.chainStrength += 1;

        // Update chain strength by fruit difficulty
        this.chainStrength += block.fruit.length * this.fruitReward;
    }

    // overrideCurrentBlock(overridingBlock: Block) {
    //     if (this.blocks.length === 0) {
    //         console.error('Invalid blockchain length for override');
    //     }

    //     // Remove last block
    //     this.blocks.pop();

    //     // Append overriding block
    //     this.blocks.push(overridingBlock);
    // }

    overrideBlockchain(fromOverrideBlockchain: Blockchain): void {
        // Create block copy
        const blocksCopy = Array.from(fromOverrideBlockchain.blocks);
        this.blocks = blocksCopy;

        this.lastBlockNum = this.blocks.length - 1;

        // Update chain strength
        this.chainStrength = fromOverrideBlockchain.chainStrength;
    }
}
