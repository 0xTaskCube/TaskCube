import { DebugContracts } from "./_components/DebugContracts";
import type { NextPage } from "next";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "TaskCube",
  description: "Taskcube",
});

const Deposit: NextPage = () => {
  return (
    <>
      <DebugContracts />
    </>
  );
};

export default Deposit;
