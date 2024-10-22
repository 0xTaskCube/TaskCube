// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract DepositWithdraw is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    struct WithdrawalRequest {
        address user;
        uint128 amount;
        uint64 requestTime;
        bool approved;
    }

    struct ContractState {
        uint128 nextRequestId;
        uint64 lastCleanup;
        uint64 withdrawalExpiration;
    }

    mapping(address => uint256) public balances;
    mapping(address => uint256) public totalDeposits;
    mapping(uint256 => WithdrawalRequest) public withdrawalRequests;
    ContractState public state;
    IERC20 public immutable usdtToken;

    event Deposited(address indexed user, uint256 amount);
    event WithdrawalRequested(uint256 indexed requestId, address indexed user, uint256 amount);
    event WithdrawalExecuted(uint256 indexed requestId, address indexed user, uint256 amount);
    event WithdrawalFailed(uint256 indexed requestId, address indexed user, uint256 amount, string reason);
    event TokensReceived(address indexed from, uint256 amount);
    event EmergencyWithdrawal(address indexed to, uint256 amount);
    event WithdrawalExpirationUpdated(uint64 newExpiration);

    error InvalidAmount();
    error InsufficientBalance();
    error InvalidRequestId();
    error InvalidUserAddress();
    error WithdrawalAlreadyApproved();
    error WithdrawalExpired();
    error TransferFailed();
    error InsufficientContractBalance();

    constructor(address _usdtAddress) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MANAGER_ROLE, msg.sender);
        _setupRole(EXECUTOR_ROLE, msg.sender);
        state.withdrawalExpiration = 7 days;
        usdtToken = IERC20(_usdtAddress);
    }

    receive() external payable {
        emit TokensReceived(msg.sender, msg.value);
    }

    function deposit(uint256 _amount) external nonReentrant whenNotPaused {
    if (_amount == 0) revert InvalidAmount();
    usdtToken.safeTransferFrom(msg.sender, address(this), _amount);
    unchecked {
        balances[msg.sender] += _amount;
        totalDeposits[msg.sender] += _amount; // 添加这行
    }
    emit Deposited(msg.sender, _amount);
}
    event WithdrawalRequestCreated(uint256 indexed requestId, address indexed user, uint256 amount);

    function requestWithdrawal(uint256 _amount) external nonReentrant whenNotPaused {
        if (_amount == 0) revert InvalidAmount();
        if (balances[msg.sender] < _amount) revert InsufficientBalance();
        
        unchecked {
            balances[msg.sender] -= _amount;
            uint256 requestId = state.nextRequestId++;
            withdrawalRequests[requestId] = WithdrawalRequest({
                user: msg.sender,
                amount: uint128(_amount),
                requestTime: uint64(block.timestamp),
                approved: false
            });
            emit WithdrawalRequested(requestId, msg.sender, _amount);
        }
    }

    function executeWithdrawal(uint256 requestId) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        WithdrawalRequest storage request = withdrawalRequests[requestId];
        
        if (request.user == address(0)) revert InvalidUserAddress();
        if (request.approved) revert WithdrawalAlreadyApproved();
        if (block.timestamp > request.requestTime + state.withdrawalExpiration) revert WithdrawalExpired();
        
        uint256 contractBalance = usdtToken.balanceOf(address(this));
        if (contractBalance < request.amount) revert InsufficientContractBalance();
        
        request.approved = true;
        
        bool success = _safeTransfer(request.user, request.amount);
        if (success) {
            emit WithdrawalExecuted(requestId, request.user, request.amount);
        } else {
            request.approved = false;
            emit WithdrawalFailed(requestId, request.user, request.amount, "Transfer failed");
            revert TransferFailed();
        }
    }

    function _safeTransfer(address to, uint256 amount) private returns (bool) {
        try usdtToken.transfer(to, amount) {
            return true;
        } catch {
            return false;
        }
    }

    function getBalance(address _user) external view returns (uint256) {
        return balances[_user];
    }
    function getTotalDeposit(address _user) external view returns (uint256) {
    return totalDeposits[_user];
}

    function getWithdrawalRequest(uint256 _requestId) external view returns (WithdrawalRequest memory) {
        return withdrawalRequests[_requestId];
    }

    function emergencyWithdraw(uint256 _amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        usdtToken.safeTransfer(msg.sender, _amount);
        emit EmergencyWithdrawal(msg.sender, _amount);
    }

    function cleanupExpiredRequests(uint256 _batchSize) external {
        uint256 i = state.lastCleanup;
        uint256 end = i + _batchSize;
        uint256 currentRequestId = state.nextRequestId;
        
        for (; i < end && i < currentRequestId; i++) {
            WithdrawalRequest storage request = withdrawalRequests[i];
            if (!request.approved && block.timestamp > request.requestTime + state.withdrawalExpiration) {
                balances[request.user] += request.amount;
                delete withdrawalRequests[i];
            }
        }
        
        state.lastCleanup = uint64(i);
    }

    function setWithdrawalExpiration(uint64 _newExpiration) external onlyRole(DEFAULT_ADMIN_ROLE) {
        state.withdrawalExpiration = _newExpiration;
        emit WithdrawalExpirationUpdated(_newExpiration);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function getContractState() external view returns (
        uint128 nextRequestId,
        uint64 lastCleanup,
        uint64 withdrawalExpiration,
        uint256 contractBalance
    ) {
        return (
            state.nextRequestId,
            state.lastCleanup,
            state.withdrawalExpiration,
            usdtToken.balanceOf(address(this))
        );
    }

    function verifyUSDTContract() external view returns (bool) {
        return usdtToken.totalSupply() > 0;
    }
}