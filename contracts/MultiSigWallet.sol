// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract MultiSigWallet {
    event Deposit(address indexed sender, uint256 amount);
    event Propose(address indexed to, uint256 value, bytes data, uint256 txId);
    event Confirm(address indexed owner, uint256 indexed txId);
    event ExecuteSuccess(uint256 indexed txId);
    event ExecuteFailure(uint256 indexed txId);
    event UpdateOwner(address indexed owner, bool isOwner);

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
    }
    uint256 balance;
    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public requiredApprovals;
    uint256 public transactionCount;
    using Counters for Counters.Counter;
    Counters.Counter public tokenIds;
    mapping (uint256 => Transaction) public transactions;
    mapping(uint256 => mapping(address => bool)) public confirmed;
    mapping(address => uint256) private balances;

    modifier onlyOwner() {
        require(isOwner[msg.sender], "not owner");
        _;
    }
    modifier txExist(uint256 _txId) {
        require(transactions[_txId].to != address(0), "tx does not exist");
        _;
    }

    modifier txIsNotExecuted(uint256 _txId) {
        require(transactions[_txId].executed == false, "tx is executed");
        _;
    }

     modifier onlyWallet() {
        require(msg.sender == address(this), "only wallet");
        _;
    }

    constructor(address[] memory _owners, uint256 _requiredApprovals) {
        require(_requiredApprovals > 0 && _requiredApprovals <= _owners.length, "invalid required number");
        for (uint256 i; i< _owners.length; i++) {
            require(_owners[i] != address(0), "invalid address");
            require(!isOwner[_owners[i]], "owners must be unique");
            isOwner[_owners[i]] = true;
        }
        owners = _owners;
        requiredApprovals = _requiredApprovals;
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    function propose(address _to, uint256 _value, bytes calldata _data) public onlyOwner returns (uint256) {
        tokenIds.increment();
        uint256 txId = tokenIds.current();
        transactions[txId] = Transaction({to: _to, value: _value, data: _data, executed: false});
        emit Propose(_to, _value, _data, txId);
        return txId;
    }


    function confirm(uint256 _txId) external onlyOwner txExist(_txId) txIsNotExecuted(_txId) {
        confirmed[_txId][msg.sender] = true;
        emit Confirm(msg.sender, _txId);
    }

    function execute(uint256 _txId) external txExist(_txId) txIsNotExecuted(_txId) {
        require((_isConfirmed(_txId)), "approvals required");
        Transaction storage txn = transactions[_txId -1];
        (bool success, ) = txn.to.call{value: txn.value}(txn.data);
        if (success){
            transactions[_txId].executed = true;
            emit ExecuteSuccess(_txId);
        } else {
            emit ExecuteFailure(_txId);
        }
    }

    function _isConfirmed(uint256 _txId) private view returns (bool) {
        uint count = 0;
        for (uint256 i; i < owners.length; i++) {
            if(confirmed[_txId][owners[i]]) {
                count++;
            }
            if (count == requiredApprovals)
                return true;
        }
        return false;
    }

    function updateOwner(address owner, bool _isOwner) public onlyWallet {
        isOwner[owner] = _isOwner;
        emit UpdateOwner(owner, _isOwner);
    }
}