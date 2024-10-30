import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // USDT 合约地址 (Sepolia测试网)
  const usdtAddress = "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0";

  await deploy("TaskReward", {
    from: deployer,
    args: [usdtAddress, deployer], // 构造函数参数：USDT地址和管理员地址
    log: true,
    autoMine: true,
  });
};

export default func;
func.tags = ["TaskReward"];
