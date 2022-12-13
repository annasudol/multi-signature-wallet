// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import './MultiSigWallet.sol';
import "@openzeppelin/contracts/access/Ownable.sol";

contract MultiSigWalletFactory is Ownable {
    event NewWallet(address);
    function create(address[] calldata owners, uint required) external returns (address deployedAt) {
        MultiSigWallet multiSigWallet = new MultiSigWallet(owners, required);
        deployedAt = address(multiSigWallet);
        emit NewWallet(deployedAt);
    }
}