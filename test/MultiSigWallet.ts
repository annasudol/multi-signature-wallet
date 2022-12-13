import { expect, assert } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
describe("MultiSigWallet", () => {
    let multiSigWalletFactory: any;
    let msw: any;
    let owners: string[];
    const owner_count = 3;
    const approvals = 2;
    let deployer: string;
    let accounts: SignerWithAddress[];
    let notOwner: SignerWithAddress;

    let fc: any;
    beforeEach(async function () {
        multiSigWalletFactory = await ethers.getContractFactory("MultiSigWallet");
    });

    it("Should initialize correctly", async function () {
        const accounts = await ethers.getSigners();
        const owner_count = 3;
        const approvals = 2;
        let owners = accounts.slice(0, owner_count).map((a) => a.address);

        const msw = await multiSigWalletFactory.deploy(owners, approvals);
        await msw.deployed();

        expect(await msw.requiredApprovals()).to.equal(approvals);

        for (let i = 0; i < owners.length; ++i) {
            expect(await msw.owners(i)).to.equal(owners[i]);
            expect(await msw.isOwner(owners[i])).to.equal(true);
        }
    });

    it("Should fail for invalid required approvals", async function () {
        const accounts = await ethers.getSigners();
        const owner_count = 3;
        const approvals = 4;
        let owners = accounts.slice(0, owner_count).map((a) => a.address);
        await expect(multiSigWalletFactory.deploy(owners, approvals)).to.be.reverted;
    });
    describe("after deployment", function () {


        beforeEach(async function () {
            multiSigWalletFactory = await ethers.getContractFactory("MultiSigWallet");

            accounts = await ethers.getSigners();
            deployer = accounts[0].address;
            owners = accounts.slice(0, owner_count).map((a: { address: string }) => a.address);
            msw = await multiSigWalletFactory.deploy(owners, approvals);
            notOwner = accounts[4];
            await msw.deployed();

            const factory = await ethers.getContractFactory("MultiSigWalletFactory");
            fc = await factory.deploy();
            await fc.deployed();
        });

        it("Should add tx when submit", async function () {
            let to = owners[1];
            let value = ethers.utils.parseEther("0.1");
            let tx = await msw.propose(to, value, []);
            await expect(tx).to.emit(msw, "Propose").withArgs(to, value, [], 1);
            tx = await msw.transactions(1);
            expect(tx.to).to.equal(to);
            expect(tx.value).to.equal(value);
            assert(ethers.utils.isHexString(tx.data, 0));
            assert(!tx.executed);
        });

        it("Should add approval when tx approved", async function () {
            let to = owners[1];
            let value = ethers.utils.parseEther("0.1");

            let txId = 1;
            await msw.propose(to, value, '0x');

            let approved = await msw.confirmed(txId, deployer);
            assert(!approved);

            await expect(msw.confirm(txId)).to.emit(msw, "Confirm").withArgs(deployer, txId);

            approved = await msw.confirmed(txId, deployer);
            assert(approved);
        });
    });
    beforeEach(async function () {
        multiSigWalletFactory = await ethers.getContractFactory("MultiSigWallet");

        accounts = await ethers.getSigners();
        deployer = accounts[0].address;
        owners = accounts.slice(0, owner_count).map((a: { address: string }) => a.address);
        msw = await multiSigWalletFactory.deploy(owners, approvals);
        notOwner = accounts[4];
        await msw.deployed();

        const factory = await ethers.getContractFactory("MultiSigWalletFactory");
        fc = await factory.deploy();
        await fc.deployed();
    });

    it("execute transaction successfully", async function () {
        const to = msw.address;
        const value = ethers.utils.parseEther("0.005");

        let ABI = [
            "function transfer(address to, uint amount)"
        ];
        let iface = new ethers.utils.Interface(ABI);
        const data = iface.encodeFunctionData("transfer", [to, value]);
        const txId = 1;

        await expect(msw.connect(notOwner).propose(to, value, data)).to.be.rejectedWith("not owner")
        await expect(msw.propose(to, value, data)).to.emit(msw, "Propose").withArgs(to, value, data, txId);
        const transaction = await msw.transactions(1);

        expect(transaction.data).to.equal(data);
        await expect(msw.execute(txId)).to.be.rejectedWith("approvals required");

        await expect(msw.connect(notOwner).confirm(txId)).to.be.rejectedWith("not owner");
        await expect(msw.confirm(2)).to.be.rejectedWith("tx does not exist");

        await expect(msw.confirm(txId)).to.emit(msw, "Confirm").withArgs(deployer, txId);

        await expect(msw.execute(txId)).to.be.rejectedWith("approvals required")
        await expect(msw.connect(accounts[1]).confirm(txId)).to.emit(msw, "Confirm").withArgs(owners[1], txId);

        //execute transaction
        await expect(msw.execute(2)).to.be.rejectedWith("tx does not exist");

        await expect(msw.execute(txId)).to.emit(msw, "ExecuteSuccess").withArgs(txId);
        await expect(msw.execute(txId)).to.be.rejectedWith("tx is executed")
        await expect(msw.connect(accounts[2]).confirm(txId)).to.be.rejectedWith("tx is executed");

        const ts = await msw.transactions(1);
        expect(ts.executed).to.be.true
    });

    describe('update owners', () => {
        const ABI = [
            "function updateOwner(address owner, bool _isOwner)"
        ];
        const iface = new ethers.utils.Interface(ABI);
        it("Only contract can change owner", async () => {
            await expect(msw.updateOwner(accounts[4].address, true)).to.be.rejectedWith("only wallet");
        });
        it("successfully add new owner", async () => {
            const call = iface.encodeFunctionData("updateOwner", [accounts[4].address, true]);
            await msw.propose(msw.address, 0, call);
            await expect(await msw.propose(accounts[4].address, 0, call)).to.emit(msw, "Propose").withArgs(accounts[4].address, 0, call, 2);
            await msw.confirm(2);
            await msw.connect(accounts[1]).confirm(2);
            await msw.execute(2);
            expect(await msw.isOwner(accounts[4].address)).to.be.true;
        });
        it("successfully remove owner", async () => {
            const call = iface.encodeFunctionData("updateOwner", [accounts[2].address, false]);
            await msw.propose(msw.address, 0, call);
            await expect(await msw.propose(accounts[2].address, 0, call)).to.emit(msw, "Propose").withArgs(accounts[2].address, 0, call, 2);
            await msw.confirm(2);
            await msw.connect(accounts[1]).confirm(2);
            await msw.execute(2);
            expect(await msw.isOwner(accounts[2].address)).to.be.false;
        });
        it("emits ExecuteFailure", async () => {
            const ABI = [
                "function updateOwner(address owner)"
            ];
            const iface = new ethers.utils.Interface(ABI);
            const data = iface.encodeFunctionData("updateOwner", [accounts[5].address]);
            await msw.propose(msw.address, 0, data);
            await expect(await msw.propose(msw.address, 0, data)).to.emit(msw, "Propose").withArgs(msw.address, 0, data, 2);
            await msw.confirm(2);
            await msw.connect(accounts[1]).confirm(2);
            await msw.execute(2);
            await expect(await msw.execute(2)).to.emit(msw, "ExecuteFailure").withArgs(2);
        });
    })
});