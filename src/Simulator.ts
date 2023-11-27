import { ConfigParams, Fruit, MinerType } from './types';
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
    ongoingMatch: boolean;
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

        this.fruitReward = this.superBlockProb / this.fruitMineProb;

        const honestMiner = new HonestMiner(0, configParams.miners.honest.mining_power, this.fruitReward);
        this.miners.push(honestMiner);
        this.honestMiner = honestMiner;
        this.minersProbWeights.push(honestMiner.miningPower * 100);

        let minerId = 1;
        for (let i = 0; i < configParams.miners.selfish.length; i++) {
            const selfishMiner = new SelfishMiner(
                minerId,
                configParams.miners.selfish[i].mining_power,
                this.fruitReward,
            );
            this.miners.push(selfishMiner);
            this.selfishMiners.push(selfishMiner);
            this.minersProbWeights.push(selfishMiner.miningPower * 100);
            this.selfishMinersProbWeights.push(selfishMiner.miningPower * 100);

            minerId++;
        }

        this.ongoingMatch = false;
    }

    simulate() {
        const progressBar = new ProgressSingleBar({}, ProgressPreset.shades_classic);
        progressBar.start(this.simulationRounds, 0);

        let blocksMined = 0;

        // Make everyone start with genesis block mined (with no fruits), owner of the genesis block is honest
        const genesisBlock = this.honestMiner.mineBlock();
        this.honestMiner.extendBlockchain(genesisBlock);
        for (let selfishMiner of this.selfishMiners) {
            selfishMiner.overrideBlockchain(this.honestMiner.chain);
        }

        while (blocksMined < this.simulationRounds) {
            // Choose mining action
            const randAction = Math.random();

            // Choose leader
            let leader: Miner;
            leader = weightedRandom(this.miners, this.minersProbWeights).item;

            if (randAction <= this.fruitMineProb) {
                // Mine fruit
                let minedFruit: Fruit;
                if (leader.type === MinerType.HONEST) {
                    if (this.ongoingMatch) {
                        // Get strongest chain competitor
                        let strongestChainCompetitor: Miner = this.matchCompetitorSelection();

                        if (strongestChainCompetitor === null) {
                            console.error('Error');
                            console.log(this.honestMiner.chain);
                            console.log(this.selfishMiners[0].chain);
                        }

                        if (this.gamma === 0) {
                            // Mine fruit into honest chain
                            minedFruit = leader.mineFruit(leader.chain);
                        } else if (this.gamma === 0.5) {
                            // Mine fruit into honest or selfish chain with probabilites 50/50
                            const chainRand = Math.random();

                            if (chainRand <= 0.5) {
                                minedFruit = leader.mineFruit(leader.chain);
                            } else {
                                minedFruit = leader.mineFruit(strongestChainCompetitor.chain);
                            }
                        } else if (this.gamma === 1) {
                            // Mine fruit into selfish chain
                            minedFruit = leader.mineFruit(strongestChainCompetitor.chain);
                        }
                    } else {
                        minedFruit = leader.mineFruit(leader.chain);
                    }

                    // Honest miner broadcast mined fruit
                    for (let selfishMiner of this.selfishMiners) {
                        selfishMiner.receiveFruit(minedFruit);
                    }
                } else if (leader.type === MinerType.SELFISH) {
                    leader.mineFruit(leader.chain);
                }
            } else {
                // Mine block
                if (leader.type === MinerType.HONEST) {
                    // Honest miner creates block
                    const minedBlock = leader.mineBlock();

                    if (this.ongoingMatch) {
                        // Resolve MATCH conflict

                        // Get strongest chain competitor
                        let strongestChainCompetitor: Miner = this.matchCompetitorSelection();

                        if (this.gamma === 0) {
                            // Honest win the fork, keep previous blocks from selifsh chain
                        } else if (this.gamma === 0.5) {
                            // Choose randomly honest/selfish miner based on their mining power (todo: check paper)
                            // longestChainCompetitor = weightedRandom(this.miners, this.minersProbWeights).item;

                            const forkRand = Math.random();

                            if (forkRand <= 0.5) {
                                // Honest win the fork, keep previous blocks from honest chain
                            } else {
                                // Selfish win the fork, keep previous blocks from selfish chain
                                leader.overrideBlockchain(strongestChainCompetitor.chain);
                            }
                        } else if (this.gamma === 1) {
                            // Choose randomly selfish miner based on their mining power
                            // longestChainCompetitor = weightedRandom(this.selfishMiners, this.selfishMinersProbWeights).item;

                            // Selfish win the fork, keep previous blocks from selfish chain
                            leader.overrideBlockchain(strongestChainCompetitor.chain);
                        }
                        this.ongoingMatch = false;
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
                    if (this.ongoingMatch) {
                        // Selfish win the fork, keep previous blocks from selfish chain
                        this.honestMiner.overrideBlockchain(leader.chain);

                        // Adapt other selfish miners that recently adapted from honest chain
                        for (let selfishMiner of this.selfishMiners) {
                            if (selfishMiner.chain.getLastBlock().ownerId === this.honestMiner.id) {
                                selfishMiner.overrideBlockchain(leader.chain);
                            }
                        }
                    } else {
                        // Selfish keep his chain private
                    }
                }
            }

            // Get max chain
            let maxChainLength = -1;

            for (let miner of this.miners) {
                const minerChainLength = miner.chain.blocks.length;
                if (minerChainLength > maxChainLength) {
                    maxChainLength = minerChainLength;
                }
            }

            if (maxChainLength < 0) {
                blocksMined = 0;
            } else {
                blocksMined = maxChainLength;
            }
            console.log(blocksMined);

            progressBar.update(blocksMined);
        }
        progressBar.stop();

        console.log(this.honestMiner.chain);
        console.log(this.selfishMiners[0].chain);
    }

    // Happens after honest mine block and publish it. Selfish miners need to decide their next action and perform it.
    // This action may reflect chain updates for other miners and for this reason, this function needs to be called recursively
    // Example: Selfish#1 reveal (override) -> Honest continue to mine on Selfish#1 -> Selfish#2 reveal -> ...
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
                if (
                    selfishStrengthDiff === 0 &&
                    selfishMiner.chain.getLastBlock().ownerId !== leader.chain.getLastBlock().ownerId
                ) {
                    // MATCH action

                    // Selfish miner will compete with honest miner next round
                    this.ongoingMatch = true;
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

    // This function is called when ongoingMatch is active and fruit/block will be mined
    // It selects one selfish miner that honest chain will be competing
    matchCompetitorSelection() {
        // Get strongest chain competitor
        let strongestChainCompetitor: Miner = null;

        // Used when there are multiple competing seflish chains
        let strongestChainMultipleCompetitors: Miner[] = [];

        for (let selfishMiner of this.selfishMiners) {
            if (
                this.honestMiner.chain.chainStrength === selfishMiner.chain.chainStrength &&
                this.honestMiner.chain.getLastBlock().ownerId !== selfishMiner.chain.getLastBlock().ownerId
            ) {
                // Found competitor of the MATCH conflict

                if (strongestChainCompetitor !== null) {
                    const differentSelfishChain = strongestChainMultipleCompetitors.every(
                        (otherSelfishMiner) =>
                            otherSelfishMiner.chain.getLastBlock().ownerId !==
                            selfishMiner.chain.getLastBlock().ownerId,
                    );

                    if (differentSelfishChain) {
                        strongestChainMultipleCompetitors.push(selfishMiner);
                    }
                } else {
                    strongestChainMultipleCompetitors.push(selfishMiner);
                }

                strongestChainCompetitor = selfishMiner;
            }
        }

        if (strongestChainMultipleCompetitors.length === 0) {
            console.error('Cannot find selfish chain competitor');
        }
        else if (strongestChainMultipleCompetitors.length === 1) {
            // Found only one competing selfish chain
            return strongestChainCompetitor;
        }
        else if (strongestChainMultipleCompetitors.length > 1) {
            // Found multiple competing selfish chains - select one randomly with unifrom distribution
            const minerIdx = Math.floor(Math.random() * strongestChainMultipleCompetitors.length);
            return strongestChainMultipleCompetitors[minerIdx];
        } 
    }
}
