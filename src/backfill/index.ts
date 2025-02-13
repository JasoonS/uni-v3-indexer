import {
  PoolEntity,
  UniswapV3FactoryContract_PoolCreatedEvent_handlerContextAsync,
  UniswapV3PoolContract_InitializeEvent_handlerContextAsync,
  UniswapV3PoolContract_SwapEvent_handlerContextAsync,
} from "generated";
import { convertTokenToDecimal } from "../utils";
import { ZERO_BD, ZERO_BI } from "../utils/constants";
import { StaticTokenDefinition } from "../utils/staticTokenDefinition";
import {
  fetchTokenDecimals,
  fetchTokenName,
  fetchTokenSymbol,
  fetchTokenTotalSupply,
} from "../utils/token";
import { publicClient, publicClients } from "../utils/viem";
import { erc20Abi, poolAbi } from "../utils/abis";

export async function populateToken(
  tokenAddress: string,
  tokenOverrides: StaticTokenDefinition[],
  context: UniswapV3FactoryContract_PoolCreatedEvent_handlerContextAsync,
  chainId: keyof typeof publicClients
): Promise<void> {
  let token = await context.Token.get(tokenAddress);
  if (token) return;

  const symbol = await fetchTokenSymbol(tokenAddress, tokenOverrides, chainId);
  const name = await fetchTokenName(tokenAddress, tokenOverrides, chainId);
  const totalSupply = await fetchTokenTotalSupply(
    tokenAddress,
    tokenOverrides,
    chainId
  );
  const decimals = await fetchTokenDecimals(
    tokenAddress,
    tokenOverrides,
    chainId
  );

  if (!decimals) return;

  token = {
    id: tokenAddress,
    symbol,
    name,
    totalSupply,
    decimals,
    derivedETH: ZERO_BD,
    volume: ZERO_BD,
    volumeUSD: ZERO_BD,
    feesUSD: ZERO_BD,
    untrackedVolumeUSD: ZERO_BD,
    totalValueLocked: ZERO_BD,
    totalValueLockedUSD: ZERO_BD,
    totalValueLockedUSDUntracked: ZERO_BD,
    txCount: ZERO_BI,
    poolCount: ZERO_BI,
    whitelistPools: [],
  };

  context.Token.set(token);
}

/**
 * Create entries in store for hard-coded pools and tokens. This is only
 * used for generating optimism pre-regenesis data.
 */
export async function populateEmptyPools(
  blockNumber: number,
  blockTimestamp: number,
  poolMappings: Array<`0x${string}`[]>,
  whitelistTokens: string[],
  tokenOverrides: StaticTokenDefinition[],
  context: UniswapV3FactoryContract_PoolCreatedEvent_handlerContextAsync,
  chainId: keyof typeof publicClients
): Promise<void> {
  const length = poolMappings.length;
  for (let i = 0; i < length; ++i) {
    const poolMapping = poolMappings[i];
    const newAddress = poolMapping[1];
    const token0Address = poolMapping[2];
    const token1Address = poolMapping[3];

    let [liquidity, feeTier, token0, token1] = await Promise.all([
      publicClients[chainId].readContract({
        address: newAddress,
        abi: poolAbi,
        functionName: "liquidity",
      }) as Promise<bigint>,
      publicClients[chainId].readContract({
        address: newAddress,
        abi: poolAbi,
        functionName: "fee",
      }) as Promise<bigint>,
      context.Token.get(token0Address),
      context.Token.get(token1Address),
      populateToken(token0Address, tokenOverrides, context, chainId), // create token entities if needed
      populateToken(token1Address, tokenOverrides, context, chainId), // create token entities if needed
    ]);

    let pool: PoolEntity = {
      id: newAddress,
      createdAtBlockNumber: blockNumber,
      createdAtTimestamp: blockTimestamp,
      token0_id: token0Address,
      token1_id: token1Address,
      liquidity,
      sqrtPrice: ZERO_BI,
      token0Price: ZERO_BD,
      token1Price: ZERO_BD,
      observationIndex: ZERO_BI,
      liquidityProviderCount: ZERO_BI,
      txCount: ZERO_BI,
      totalValueLockedToken0: ZERO_BD,
      totalValueLockedToken1: ZERO_BD,
      totalValueLockedETH: ZERO_BD,
      totalValueLockedUSD: ZERO_BD,
      totalValueLockedUSDUntracked: ZERO_BD,
      volumeToken0: ZERO_BD,
      volumeToken1: ZERO_BD,
      volumeUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      feesUSD: ZERO_BD,
      collectedFeesToken0: ZERO_BD,
      collectedFeesToken1: ZERO_BD,
      collectedFeesUSD: ZERO_BD,
      feeTier: feeTier,
      tick: undefined,
    };

    if (token0 && token1) {
      if (whitelistTokens.includes(pool.token0_id)) {
        const newPools = token1.whitelistPools;
        newPools.push(pool.id);
        token1 = {
          ...token1,
          whitelistPools: newPools,
        };
      }

      if (whitelistTokens.includes(token1.id)) {
        const newPools = token0.whitelistPools;
        newPools.push(pool.id);
        token0 = {
          ...token0,
          whitelistPools: newPools,
        };
      }

      // populate the TVL by call contract balanceOf
      const [tvlToken0Raw, tvlToken1Raw] = await Promise.all([
        publicClients[chainId].readContract({
          address: pool.token0_id as `0x${string}`,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [pool.id],
        }) as Promise<bigint>,
        publicClients[chainId].readContract({
          address: pool.token1_id as `0x${string}`,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [pool.id],
        }) as Promise<bigint>,
      ]);

      const tvlToken0Adjusted = convertTokenToDecimal(
        tvlToken0Raw,
        token0.decimals
      );

      pool = {
        ...pool,
        totalValueLockedToken0: tvlToken0Adjusted,
      };

      token0 = {
        ...token0,
        totalValueLocked: tvlToken0Adjusted,
      };

      const tvlToken1Adjusted = convertTokenToDecimal(
        tvlToken1Raw,
        token1.decimals
      );

      pool = {
        ...pool,
        totalValueLockedToken1: tvlToken1Adjusted,
      };

      token1 = {
        ...token1,
        totalValueLocked: tvlToken1Adjusted,
      };

      context.Token.set(token0);
      context.Token.set(token1);
      context.Pool.set(pool);
    }
  }
}
