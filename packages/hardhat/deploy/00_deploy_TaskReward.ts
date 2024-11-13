import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const usdtAddress = "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0";

  await deploy("TaskReward", {
    from: deployer,
    args: [usdtAddress, deployer],
    log: true,
    autoMine: true,
  });
};

export default func;
func.tags = ["TaskReward"];
