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
        uint256 totalParticipants;
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
    mapping(uint256 => uint256) public claimedRewards;
    mapping(uint256 => uint256) public completedTaskCount;

    uint256 public nextTaskId;
    uint256 public nextClaimId;
    
    event TaskCreated(uint256 indexed taskId, address indexed creator, uint256 totalReward);
    event ClaimSubmitted(uint256 indexed claimId, uint256 indexed taskId, address indexed user, uint256 amount);
    event ClaimApproved(uint256 indexed claimId);
    event ClaimExecuted(uint256 indexed claimId, address indexed user, uint256 amount);
    event TokensWithdrawn(address indexed to, uint256 amount);
    
    // 添加新的调试事件
    event TaskDebug(
        uint256 taskId, 
        uint256 totalReward,
        uint256 claimedAmount,
        uint256 remainingReward
    );

    constructor(address _usdtToken, address admin) {
        usdtToken = IERC20(_usdtToken);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }
    
        function createTask(uint256 totalReward, uint256 _totalParticipants) external whenNotPaused nonReentrant returns (uint256) {
        require(totalReward > 0, "Invalid reward amount");
        require(_totalParticipants > 0, "Invalid participants count");  
        
        require(usdtToken.transferFrom(msg.sender, address(this), totalReward), "Transfer failed");
        
        uint256 taskId = nextTaskId++;
        tasks[taskId] = Task({
            creator: msg.sender,
            totalReward: totalReward,
            remainingReward: totalReward, 
            totalParticipants: _totalParticipants, 
            isActive: true
        });
        
        emit TaskCreated(taskId, msg.sender, totalReward);
        return taskId;
    }
    
    function submitClaim(uint256 taskId, uint256 amount) external whenNotPaused nonReentrant returns (uint256) {       
        if (taskId != 0) {
            Task storage task = tasks[taskId];
            require(task.isActive && amount <= task.remainingReward, "Invalid claim conditions");
        }
        
       
        uint256 claimId = nextClaimId++;
        claims[claimId] = Claim({
            user: msg.sender,
            taskId: taskId,
            amount: amount,
            approved: true,  
            executed: false
        });
        emit ClaimSubmitted(claimId, taskId, msg.sender, amount);
        return claimId;
    }

    function markTaskCompleted(uint256 taskId) external {
        Task storage task = tasks[taskId];
        require(task.isActive, "Task not active");
        require(msg.sender == task.creator, "Only task creator can mark completion");
        require(completedTaskCount[taskId] < task.totalParticipants, "All tasks completed");
        
        completedTaskCount[taskId] += 1; 
    }

    function executeClaim(uint256 claimId) external nonReentrant {
        Claim storage claim = claims[claimId];
        require(claim.user == msg.sender, "Only claim creator can execute");
        require(!claim.executed, "Claim already executed");
        
        if (claim.taskId != 0) {
            Task storage task = tasks[claim.taskId];
            require(task.isActive, "Task not active");
            require(claim.amount <= task.remainingReward, "Insufficient remaining reward");
        
            claim.executed = true;
           
            claimedRewards[claim.taskId] += claim.amount;  
            task.remainingReward = task.remainingReward - claim.amount;
        }
        
        
        require(usdtToken.transfer(claim.user, claim.amount), "Transfer failed");
        
        emit ClaimExecuted(claimId, claim.user, claim.amount);
    }

    // 添加这个函数来查询已领取的奖励
    function getClaimedRewards(uint256 taskId) public view returns (uint256) {
        return claimedRewards[taskId];
    }
    
    function adminExecuteClaim(uint256 claimId) external onlyRole(ADMIN_ROLE) nonReentrant {
        Claim storage claim = claims[claimId];
        require(!claim.executed, "Claim already executed");
        
        if (claim.taskId != 0) {
            Task storage task = tasks[claim.taskId];
            require(task.isActive, "Task not active");
            require(claim.amount <= task.remainingReward, "Insufficient remaining reward");
           
            claim.executed = true;
           
            claimedRewards[claim.taskId] += claim.amount;  
            task.remainingReward = task.remainingReward - claim.amount;
        }
        
        
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
    
   
    event TaskWithdrawn(uint256 indexed taskId, address indexed creator, uint256 amount);

    function withdrawTaskRemaining(uint256 taskId) external nonReentrant {
        Task storage task = tasks[taskId];
        require(msg.sender == task.creator, "Only creator can withdraw");
        require(task.isActive, "Task not active");
        
        // 使用 completedTaskCount 而不是计算值
        uint256 completed = completedTaskCount[taskId];
        
        // 计算实际可提取金额：未完成任务的奖励
        uint256 withdrawAmount = (task.totalParticipants - completed) * (task.totalReward / task.totalParticipants);
        require(withdrawAmount > 0, "No remaining reward");
        
        task.remainingReward = 0;
        task.isActive = false;
        
        require(usdtToken.transfer(msg.sender, withdrawAmount), "Transfer failed");
        
        emit TaskWithdrawn(taskId, msg.sender, withdrawAmount);
    }
}