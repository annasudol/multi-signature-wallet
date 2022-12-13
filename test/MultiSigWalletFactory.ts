import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { MultiSigWalletFactory } from '../typechain-types';

describe('MultiSigWalletFactory', () => {
    let contract: MultiSigWalletFactory;
    let factoryOwner: SignerWithAddress;
    let owners: SignerWithAddress[];
    const numberOfOwners: number = 4;
    const required: number = 1;

    beforeEach(async () => {
        factoryOwner = (await ethers.getSigners())[0];
        owners = (await ethers.getSigners()).slice(0, numberOfOwners);

        const MultiSigWalletFactory = await ethers.getContractFactory('MultiSigWalletFactory');
        contract = await MultiSigWalletFactory.deploy();
        await contract.deployed();
    })

    describe('after deployment', () => {
        it('displays owner correctly', async () => {
            expect(await contract.owner()).to.equal(factoryOwner.address);
        });

        it('emits NewWallet event', async () => {
            await expect(contract.create(owners.map(owner => owner.address), required)).to.emit(contract, 'NewWallet');
        });

        it('displays state values properly', async () => {
            const crateTx = await contract.create(owners.map(owner => owner.address), required);
            const txResult: any = await crateTx.wait();
            const newMultiSigWalletAddress = txResult.events[0].args[0];

            const MultiSigWallet = await ethers.getContractFactory('MultiSigWallet');
            const newMultiSigWalletContract = MultiSigWallet.attach(newMultiSigWalletAddress);

            owners.forEach(async (owner, i) => {
                expect(await newMultiSigWalletContract.owners(i)).to.equal(owner.address);
            });
            expect(await newMultiSigWalletContract.requiredApprovals()).to.equal(required);
        });
    });
    describe('create new wallet', () => {
        it('emits NewWallet event', async () => {
            await expect(contract.create(owners.map(owner => owner.address), required)).to.emit(contract, 'NewWallet');
        });
        it('displays state values properly', async () => {
            const crateTx = await contract.create(owners.map(owner => owner.address), required);
            const txResult: any = await crateTx.wait();
            const newMultiSigWalletAddress = txResult.events[0].args[0];

            const MultiSigWallet = await ethers.getContractFactory('MultiSigWallet');
            const newMultiSigWalletContract = MultiSigWallet.attach(newMultiSigWalletAddress);

            owners.forEach(async (owner, i) => {
                expect(await newMultiSigWalletContract.owners(i)).to.equal(owner.address);
            });
            expect(await newMultiSigWalletContract.requiredApprovals()).to.equal(required);
        });

        it('reverts transaction', async () => {
            await expect(contract.create([owners[0].address, ethers.constants.AddressZero], 2)).to.be.rejectedWith("invalid address")
            await expect(contract.create([owners[0].address, owners[0].address], 2)).to.be.rejectedWith("owners must be unique")
        });
    });
})