import { ConfigParams, MinerType } from 'src/types';
import HonestMiner from './HonestMiner';
import SelfishMiner from './SelfishMiner';
import Miner from './Miner';
import { SingleBar as ProgressSingleBar, Presets as ProgressPreset } from 'cli-progress';
import weightedRandom from './Helper';

export default class Simulator {
    simulationRounds: number;
    gamma: number;
    fruitMineProb: number;
    superBlockProb: number;
    ongoingFork: boolean;
    miners: Miner[];
    minersProbWeights: number[];

    // just references
    honestMiner: HonestMiner;
    selfishMiners: SelfishMiner[];
    selfishMinersProbWeights: number[];

    fruitReward: number; // blockReward = 1, fruitReward = fraction of blockReward because its easier to mine

    constructor(configParams: ConfigParams) {
        this.simulationRounds = configParams.simulation_mining_rounds;
        this.gamma = configParams.gamma;
        this.fruitMineProb = configParams.fruit_mine_prob;
        this.superBlockProb = configParams.superblock_prob;
        this.miners = [];
        this.minersProbWeights = [];
        this.selfishMiners = [];
        this.selfishMinersProbWeights = [];

        const honestMiner = new HonestMiner(0, configParams.miners.honest.mining_power, this.fruitReward);
        this.miners.push(honestMiner);
        this.honestMiner = honestMiner;
        this.minersProbWeights.push(honestMiner.miningPower * 100);

        let i = 1;
        for (let i = 1; i < configParams.miners.selfish.length; i++) {
            const selfishMiner = new SelfishMiner(i, configParams.miners.selfish[i].mining_power, this.fruitReward);
            this.miners.push(selfishMiner);
            this.selfishMiners.push(selfishMiner);
            this.minersProbWeights.push(selfishMiner.miningPower * 100);
            this.selfishMinersProbWeights.push(selfishMiner.miningPower * 100);
        }

        this.ongoingFork = false;

        this.fruitReward = this.superBlockProb / this.fruitMineProb;
    }

    simulate() {
        const progressBar = new ProgressSingleBar({}, ProgressPreset.shades_classic);
        progressBar.start(this.simulationRounds, 0);
        
        for (let i = 0; i < this.simulationRounds; i++) {
            // Choose mining action
            const randAction = Math.random();

            // Choose leader
            let leader: Miner;
            leader = weightedRandom(this.miners, this.minersProbWeights).item;

            if (randAction <= this.fruitMineProb) {
                // Mine fruit
            } else {
                // Mine block
                if (leader.type === MinerType.HONEST) {
                    // Honest miner creates block
                    const minedBlock = leader.mineBlock();

                    if (this.ongoingFork) {
                        // Resolve MATCH conflict

                        // Get strongest chain competitor
                        let strongestChainCompetitor: Miner = null;

                        for (let selfishMiner of this.selfishMiners) {
                            if (
                                leader.chain.chainStrength === selfishMiner.chain.chainStrength &&
                                leader.chain.getLastBlock().ownerId !== selfishMiner.chain.getLastBlock().ownerId
                            ) {
                                // Found competitor of the MATCH conflict
                                strongestChainCompetitor = selfishMiner;
                                break;
                            }
                        }

                        if (this.gamma === 0) {
                            // Honest win fork, keep previous blocks from selifsh chain
                        } else if (this.gamma === 0.5) {
                            // Choose randomly honest/selfish miner based on their mining power (todo: check paper)
                            // longestChainCompetitor = weightedRandom(this.miners, this.minersProbWeights).item;

                            const forkRand = Math.random();

                            if (forkRand <= 0.5) {
                                // Honest win fork, keep previous blocks from honest chain
                            } else {
                                // Selfish win fork, keep previous blocks from selfish chain
                                leader.overrideBlockchain(strongestChainCompetitor.chain);
                            }
                        } else if (this.gamma === 1) {
                            // Choose randomly selfish miner based on their mining power
                            // longestChainCompetitor = weightedRandom(this.selfishMiners, this.selfishMinersProbWeights).item;

                            // Selfish win fork, keep previous blocks from selfish chain
                            leader.overrideBlockchain(strongestChainCompetitor.chain);
                        }
                        this.ongoingFork = false;
                    } else {
                        // Honest miner typically mines his block
                    }

                    // Honest miner extends his chain
                    leader.extendBlockchain(minedBlock);

                    // Make resoltuion when honest miner mined block
                    let repeatResolution = this.roundResolution(leader);
                    while (repeatResolution) {
                        // Repeat resolution where honest miner chain may be overwritten by selfish miners
                        repeatResolution = this.roundResolution(leader);
                    }
                } else if (leader.type === MinerType.SELFISH) {
                    // Selifsh miner creates block
                    const minedBlock = leader.mineBlock();
                    leader.extendBlockchain(minedBlock);
                }
            }

            progressBar.update(i + 1);
        }
        progressBar.stop();
    }

    roundResolution(leader: Miner): boolean {
        // Store all selfish that are willing to override in this round
        const overridingSelifshMiners: Miner[] = [];

        // For honest miner - Publish this block to other miners (selfish miners)
        for (let selfishMiner of this.selfishMiners) {
            // Decide, what selifsh miner do when he is notified about new honest block

            // const selfishBlockDiff = selfishMiner.chain.lastBlockNum - leader.chain.lastBlockNum;
            const selfishStrengthDiff =
                selfishMiner.chain.chainStrength - leader.chain.chainStrength + selfishMiner.getFruitCount();
            const selfishPowerDiff = selfishMiner.miningPower - leader.miningPower;

            if (selfishStrengthDiff >= 2) {
                // WAIT action
                // Selfish lead by 2 or more blocks, ignore this block
            } else if (selfishStrengthDiff < 2 && selfishStrengthDiff >= 1) {
                // OVERRIDE action
                // Selifsh lead only by one block, selfish override the chain
                overridingSelifshMiners.push(selfishMiner);
            } else if (selfishStrengthDiff < 1 && selfishStrengthDiff >= 0) {
                if (selfishStrengthDiff === 0) {
                    // MATCH action

                    // Selfish miner will compete with honest miner next round
                    this.ongoingFork = true;
                } else if (selfishPowerDiff > 0 && selfishStrengthDiff > selfishPowerDiff) {
                    // WAIT ACTION
                    // Selfish lead by 2 or more blocks, ignore this block
                } else if (selfishPowerDiff > 0 && selfishStrengthDiff <= selfishPowerDiff) {
                    // OVERRIDE action
                    // Selifsh lead only by one block, selfish override the chain
                    overridingSelifshMiners.push(selfishMiner);
                } else {
                    // OVERRIDE action
                    // Selifsh lead only by one block, selfish override the chain
                    overridingSelifshMiners.push(selfishMiner);
                }
            } else {
                // ADAPT action

                // Selifsh adapts - overrides his chain with honest one's
                selfishMiner.overrideBlockchain(leader.chain);
            }
        }

        // Resolve overrides from selfish miners - select the strongest one
        if (overridingSelifshMiners.length > 0) {
            let selectedOverridingSelfishMiner: Miner = null;

            let strongestOverridingMiner: Miner = null;

            // If there are multiple selfish miners that have same strength and want to override,
            // one of them will be selected randomly
            let conflictSelfishMiners: Miner[] = [];
            let conflictSelfishMinersProb: number[] = [];

            // Find overriding selfish miner/miners with highest chain stregth
            for (let singleOverridingSelfishMiner of overridingSelifshMiners) {
                if (strongestOverridingMiner === null) {
                    strongestOverridingMiner = singleOverridingSelfishMiner;
                    conflictSelfishMiners.push(singleOverridingSelfishMiner);
                    conflictSelfishMinersProb.push(singleOverridingSelfishMiner.chain.chainStrength);
                } else {
                    if (
                        singleOverridingSelfishMiner.chain.chainStrength > strongestOverridingMiner.chain.chainStrength
                    ) {
                        conflictSelfishMiners = [];
                        strongestOverridingMiner = singleOverridingSelfishMiner;
                        conflictSelfishMiners.push(singleOverridingSelfishMiner);
                        conflictSelfishMinersProb.push(singleOverridingSelfishMiner.chain.chainStrength);
                    } else if (
                        singleOverridingSelfishMiner.chain.chainStrength ===
                        strongestOverridingMiner.chain.chainStrength
                    ) {
                        strongestOverridingMiner = singleOverridingSelfishMiner;
                        conflictSelfishMiners.push(singleOverridingSelfishMiner);
                        conflictSelfishMinersProb.push(singleOverridingSelfishMiner.chain.chainStrength);
                    }
                }
            }

            // Select overriding selfish miner
            if (conflictSelfishMiners.length > 1) {
                // There are multiple selfish miners with equal chain strength
                selectedOverridingSelfishMiner = weightedRandom(conflictSelfishMiners, conflictSelfishMinersProb).item;
            } else {
                // There is only one overriding selfish miner with highest chain strength
                selectedOverridingSelfishMiner = conflictSelfishMiners[0];
            }

            // Override honest miner chain
            this.honestMiner.overrideBlockchain(selectedOverridingSelfishMiner.chain);

            return true;
        } else {
            return false;
        }
    }
}