// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract TaskReward is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    IERC20 public immutable usdtToken;
    
    struct Task {
        address creator;
        uint256 totalReward;
        uint256 remainingReward;
        bool isActive;
    }
    
    struct Claim {
        address user;
        uint256 taskId;
        uint256 amount;
        bool approved;
        bool executed;
    }
    
    mapping(uint256 => Task) public tasks;
    mapping(uint256 => Claim) public claims;
    uint256 public nextTaskId;
    uint256 public nextClaimId;
    
    event TaskCreated(uint256 indexed taskId, address indexed creator, uint256 totalReward);
    event ClaimSubmitted(uint256 indexed claimId, uint256 indexed taskId, address indexed user, uint256 amount);
    event ClaimApproved(uint256 indexed claimId);
    event ClaimExecuted(uint256 indexed claimId, address indexed user, uint256 amount);
    
    constructor(address _usdtToken, address admin) {
        usdtToken = IERC20(_usdtToken);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }
    
    function createTask(uint256 totalReward) external whenNotPaused nonReentrant returns (uint256) {
        require(totalReward > 0, "Invalid reward amount");
        
        // Transfer USDT from user to contract
        require(usdtToken.transferFrom(msg.sender, address(this), totalReward), "Transfer failed");
        
        uint256 taskId = nextTaskId++;
        tasks[taskId] = Task({
            creator: msg.sender,
            totalReward: totalReward,
            remainingReward: totalReward,
            isActive: true
        });
        
        emit TaskCreated(taskId, msg.sender, totalReward);
        return taskId;
    }
    
    function submitClaim(uint256 taskId, uint256 amount) external whenNotPaused nonReentrant returns (uint256) {
        require(tasks[taskId].isActive, "Task not active");
        require(amount <= tasks[taskId].remainingReward, "Insufficient remaining reward");
        
        uint256 claimId = nextClaimId++;
        claims[claimId] = Claim({
            user: msg.sender,
            taskId: taskId,
            amount: amount,
            approved: false,
            executed: false
        });
        
        emit ClaimSubmitted(claimId, taskId, msg.sender, amount);
        return claimId;
    }
    
    function approveClaim(uint256 claimId) external onlyRole(ADMIN_ROLE) {
        require(!claims[claimId].approved, "Claim already approved");
        require(!claims[claimId].executed, "Claim already executed");
        
        claims[claimId].approved = true;
        emit ClaimApproved(claimId);
    }
    
    function executeClaim(uint256 claimId) external onlyRole(ADMIN_ROLE) nonReentrant {
        Claim storage claim = claims[claimId];
        require(claim.approved, "Claim not approved");
        require(!claim.executed, "Claim already executed");
        
        Task storage task = tasks[claim.taskId];
        require(task.isActive, "Task not active");
        require(claim.amount <= task.remainingReward, "Insufficient remaining reward");
        
        task.remainingReward -= claim.amount;
        claim.executed = true;
        
        require(usdtToken.transfer(claim.user, claim.amount), "Transfer failed");
        
        emit ClaimExecuted(claimId, claim.user, claim.amount);
    }
    
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    function withdrawTokens(address to, uint256 amount) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(to != address(0), "Invalid address");
        require(amount > 0, "Invalid amount");
        require(amount <= usdtToken.balanceOf(address(this)), "Insufficient balance");
        
        require(usdtToken.transfer(to, amount), "Transfer failed");
        
        emit TokensWithdrawn(to, amount);
    }
    
    event TokensWithdrawn(address indexed to, uint256 amount);
}