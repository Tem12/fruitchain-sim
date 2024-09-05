export type ConfigParams = {
    consensus_name: string;
    miners: { honest: { mining_power: number }; selfish: { mining_power: number }[] };
    gamma: number;
    simulation_mining_rounds: number;
    fruit_mine_prob: number;
    superblock_prob: number;
    log_output: boolean | undefined;
};

export enum MinerType {
    HONEST,
    SELFISH,
}

export enum MinerAction {
    WAIT,
    OVERRIDE,
    MATCH,
    ADAPT,
}

export type Block = {
    ownerId: number,
    fruit: Fruit[],
}

export type Fruit = {
    ownerId: number;
    lastBlockOwnerId: number;
    lastBlockNum: number;
};
