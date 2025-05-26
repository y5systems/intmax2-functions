import { TokenMap, TokenMapData, TokenType } from "@intmax2-functions/shared";
import { type PublicClient, erc20Abi } from "viem";
import { MULTICALL_SIZE } from "../constants";
import type { TokenInfo } from "../types";

type MulticallResult = {
  status: "success" | "failure";
  result?: string | number;
  error?: Error;
};

export const saveTokenIndexMaps = async (
  ethereumClient: PublicClient,
  tokenInfoMap: Map<number, TokenInfo>,
) => {
  const supportedTokenMap = filterERC20Tokens(tokenInfoMap);
  if (supportedTokenMap.size === 0) {
    return [];
  }

  const newSupportedTokenMap = await filterNewERC20Tokens(supportedTokenMap);
  if (newSupportedTokenMap.size === 0) {
    return [];
  }

  const tokenValues = Array.from(newSupportedTokenMap.values());
  const metadata = await fetchTokenMetadata(ethereumClient, tokenValues);
  const enrichedTokens = enrichTokensWithMetadata(newSupportedTokenMap, metadata);
  await saveTokenMaps(enrichedTokens);

  return enrichedTokens;
};

const filterERC20Tokens = (tokenInfoMap: Map<number, TokenInfo>) => {
  // Renamed from filterERC20Tokens, but now handles both ERC20 and NATIVE tokens
  const filteredTokenMap = new Map<number, TokenInfo>();

  tokenInfoMap.forEach((tokenInfo, tokenIndex) => {
    // Include both ERC20 and NATIVE tokens
    if (tokenInfo.tokenType === TokenType.ERC20 || tokenInfo.tokenType === TokenType.NATIVE) {
      filteredTokenMap.set(tokenIndex, tokenInfo);
    }
  });

  return filteredTokenMap;
};

const filterNewERC20Tokens = async (tokenMap: Map<number, TokenInfo>) => {
  // Kept old name for simplicity, but now handles both ERC20 and Native tokens
  const tokenIndexes = Array.from(tokenMap.keys()).map(String);
  const existingMaps = await TokenMap.getInstance().fetchTokenMaps({
    tokenIndexes,
  });
  const existingIndexSet = new Set(existingMaps.map((map) => String(map.tokenIndex)));

  return new Map(
    Array.from(tokenMap.entries()).filter(([index]) => !existingIndexSet.has(String(index))),
  );
};

const fetchTokenMetadata = async (ethereumClient: PublicClient, tokens: TokenInfo[]) => {
  // Filter to only include ERC20 tokens for multicall
  const erc20Tokens = tokens.filter(token => token.tokenType === TokenType.ERC20);
  
  if (erc20Tokens.length === 0) {
    return { decimals: [], symbols: [] };
  }
  
  const createConfig = (functionName: "decimals" | "symbol") => ({
    contracts: erc20Tokens.map(({ tokenAddress }) => ({
      address: tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName,
      args: [],
    })),
    batchSize: MULTICALL_SIZE,
  });

  const [decimalsResults, symbolsResults] = await Promise.all([
    ethereumClient.multicall(createConfig("decimals")),
    ethereumClient.multicall(createConfig("symbol")),
  ]);

  return { decimals: decimalsResults, symbols: symbolsResults };
};

const enrichTokensWithMetadata = (
  tokenInfoMap: Map<number, TokenInfo>,
  metadata: {
    decimals: MulticallResult[];
    symbols: MulticallResult[];
  },
) => {
  const tokenEntries = Array.from(tokenInfoMap.entries());
  const erc20TokenEntries = tokenEntries.filter(([, token]) => token.tokenType === TokenType.ERC20);
  const nativeTokenEntries = tokenEntries.filter(([, token]) => token.tokenType === TokenType.NATIVE);
  
  // Process ERC20 tokens with metadata
  const processedErc20Tokens = erc20TokenEntries.map(([tokenIndex, token], arrayIndex) => {
    // Only check metadata if we have any ERC20 tokens
    if (metadata.decimals.length > 0 && metadata.symbols.length > 0) {
      const decimalsResult = metadata.decimals[arrayIndex];
      const symbolResult = metadata.symbols[arrayIndex];

      if (decimalsResult.status !== "success" || symbolResult.status !== "success") {
        throw new Error(
          `Failed to fetch metadata for token ${token.tokenAddress}. ` +
            `Decimals: ${decimalsResult.error?.message}, Symbol: ${symbolResult.error?.message}`,
        );
      }

      return {
        tokenIndex,
        tokenId: token.tokenId,
        tokenType: TokenType.ERC20,
        decimals: decimalsResult.result as number,
        symbol: symbolResult.result as string,
        contractAddress: token.tokenAddress.toLowerCase(),
      };
    } else {
      throw new Error(`No metadata available for ERC20 token ${token.tokenAddress}`);
    }
  });
  
  // Add native tokens with hardcoded values
  const processedNativeTokens = nativeTokenEntries.map(([tokenIndex, token]) => {
    return {
      tokenIndex,
      tokenId: token.tokenId,
      tokenType: TokenType.NATIVE,
      decimals: 18, // ETH has 18 decimals
      symbol: "ETH", // Assuming the native token is ETH
      contractAddress: token.tokenAddress.toLowerCase(),
    };
  });
  
  return [...processedErc20Tokens, ...processedNativeTokens];
  
};

const saveTokenMaps = async (enrichedTokens: TokenMapData[]) => {
  const tokenMap = TokenMap.getInstance();
  await tokenMap.saveTokenMapsBatch(enrichedTokens);
};
