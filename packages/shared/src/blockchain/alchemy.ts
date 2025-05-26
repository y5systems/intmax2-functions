import { Alchemy as AlchemyInstance, Network } from "alchemy-sdk";
import { config } from "../config";
import { logger } from "../lib";

export class Alchemy {
  private alchemy: AlchemyInstance;
  private networkKey = `${config.NETWORK_TYPE}-${config.NETWORK_ENVIRONMENT}`;

  constructor(apiKey = config.ALCHEMY_API_KEY) {
    logger.debug(`Attempting to get alchemy network for: "${this.networkKey}"`);

    const network = this.getNetwork();
    const settings = {
      apiKey: apiKey,
      network,
      maxRetries: 5,
    };
    this.alchemy = new AlchemyInstance({ ...settings });
  }

  private getNetwork = () => {
    switch (this.networkKey) {
      case "ethereum-mainnet":
        return Network.ETH_MAINNET;
      case "ethereum-sepolia":
        return Network.BASE_SEPOLIA;
      case "scroll-mainnet":
        return Network.SCROLL_MAINNET;
      case "scroll-sepolia":
        return Network.SCROLL_SEPOLIA;
      default:
        throw new Error(`Unsupported network: ${this.networkKey}. Please check the configuration.`);
    }
  };

  async getBlock(blockNumber: bigint) {
    const blockHashOrBlockTag = `0x${Number(blockNumber).toString(16)}`;
    return this.alchemy.core.getBlock(blockHashOrBlockTag);
  }
}
