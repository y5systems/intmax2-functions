import { http, type Chain, type PublicClient, createPublicClient } from "viem";
import { mainnet, scroll, scrollSepolia, sepolia } from "viem/chains";
import { config } from "../config";

export const networkConfig = {
  ethereum: {
    mainnet: {
      chain: mainnet,
      rpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${config.ALCHEMY_API_KEY}`,
    },
    sepolia: {
      chain: sepolia,
      rpcUrl: `https://base-sepolia.infura.io/v3/67e3f29b5f69455c9c07f884cf02d854`,
    },
  },
  scroll: {
    mainnet: {
      chain: scroll,
      rpcUrl: `https://scroll-mainnet.g.alchemy.com/v2/${config.ALCHEMY_API_KEY}`,
    },
    sepolia: {
      chain: scrollSepolia,
      rpcUrl: `https://scroll-sepolia.infura.io/v3/67e3f29b5f69455c9c07f884cf02d854`,
    },
  },
};

export const createNetworkClient = (network: "ethereum" | "scroll") => {
  const { chain, rpcUrl } = networkConfig[network][config.NETWORK_ENVIRONMENT];

  return createPublicClient({
    batch: {
      multicall: true,
    },
    chain: chain as Chain,
    transport: http(rpcUrl),
  }) as PublicClient;
};
