import React from "react";
import Link from "next/link";
import { EthIcon } from "./EthIcon";
import { FaBook, FaPaperPlane, FaXTwitter } from "react-icons/fa6";
import { sepolia } from "viem/chains";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Faucet } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { useGlobalState } from "~~/services/store/store";

export const Footer = () => {
  const nativeCurrencyPrice = useGlobalState(state => state.nativeCurrency.price);
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === sepolia.id;

  return (
    <div className="w-full py-5 px-6">
      <div className="flex flex-col items-center md:flex-row md:justify-between md:items-center gap-4">
        <div className="hidden md:flex md:flex-wrap md:items-center gap-2 ">
          {nativeCurrencyPrice > 0 && (
            <div className="btn btn-primary btn-sm font-normal cursor-pointer text-white">
              <EthIcon className="h-5 w-5" />
              <span>{nativeCurrencyPrice.toFixed(2)}</span>
            </div>
          )}
          {/* {isLocalNetwork && (
            <>
              <Faucet />
              <Link
                href="/blockexplorer"
                passHref
                className="btn btn-primary btn-sm font-normal cursor-pointer text-white"
              >
                <MagnifyingGlassIcon className="h-4 w-4" />
                <span>Block Explorer</span>
              </Link>
            </>
          )} */}
        </div>

        {/* Social media icons - always visible and centered */}
        <div className="flex items-center gap-4 text-sm text-white">
          <a href="https://twitter.com" target="_blank" rel="noreferrer" className="text-xl">
            <FaXTwitter />
          </a>
          <a href="https://telegram.org" target="_blank" rel="noreferrer" className="text-xl">
            <FaPaperPlane />
          </a>
          <a href="https://example.com/book" target="_blank" rel="noreferrer" className="text-xl">
            <FaBook />
          </a>
        </div>
      </div>
    </div>
  );
};
