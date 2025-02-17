import {
  BundleEntity,
  FactoryEntity,
  PoolDayDataEntity,
  PoolEntity,
  PoolHourDataEntity,
  TokenDayDataEntity,
  TokenEntity,
  TokenHourDataEntity,
  UniswapDayDataEntity,
  UniswapV3PoolContract_BurnEvent_handlerContext,
  UniswapV3PoolContract_BurnEvent_handlerContextAsync,
  UniswapV3PoolContract_CollectEvent_handlerContext,
  UniswapV3PoolContract_CollectEvent_handlerContextAsync,
  UniswapV3PoolContract_InitializeEvent_handlerContextAsync,
  UniswapV3PoolContract_MintEvent_handlerContext,
  UniswapV3PoolContract_MintEvent_handlerContextAsync,
  UniswapV3PoolContract_SwapEvent_handlerContext,
  UniswapV3PoolContract_SwapEvent_handlerContextAsync,
} from "generated";
import { ONE_BI, ZERO_BD, ZERO_BI } from "./constants";

export function getDayID(timestamp: number) {
  return Math.floor(timestamp / 86400); // rounded
}

export function getDayStartTimestamp(dayID: number) {
  return dayID * 86400;
}

export function getHourIndex(timestamp: number) {
  return Math.floor(timestamp / 3600); // get unique hour within unix history
}

export function getHourStartUnix(hourIndex: number) {
  return hourIndex * 3600; // want the rounded effect
}

/**
 * Tracks global aggregate data over daily windows
 * @param event
 */
export async function updateUniswapDayData(
  dayID: number,
  factory: FactoryEntity,
  context:
    | UniswapV3PoolContract_BurnEvent_handlerContextAsync
    | UniswapV3PoolContract_CollectEvent_handlerContextAsync
    | UniswapV3PoolContract_MintEvent_handlerContextAsync
    | UniswapV3PoolContract_SwapEvent_handlerContextAsync
): Promise<UniswapDayDataEntity> {
  const dayStartTimestamp = getDayStartTimestamp(dayID);
  let uniswapDayData = await context.UniswapDayData.get(dayID.toString());
  if (!uniswapDayData) {
    uniswapDayData = {
      id: dayID.toString(),
      date: dayStartTimestamp,
      volumeETH: ZERO_BD,
      volumeUSD: ZERO_BD,
      volumeUSDUntracked: ZERO_BD,
      feesUSD: ZERO_BD,
      tvlUSD: factory.totalValueLockedUSD,
      txCount: factory.txCount,
    };
  }

  uniswapDayData = {
    ...uniswapDayData,
    tvlUSD: factory.totalValueLockedUSD,
    txCount: factory.txCount,
  };

  context.UniswapDayData.set(uniswapDayData);

  return uniswapDayData;
}

export async function updatePoolDayData(
  dayID: number,
  pool: PoolEntity,
  context:
    | UniswapV3PoolContract_BurnEvent_handlerContextAsync
    | UniswapV3PoolContract_CollectEvent_handlerContextAsync
    | UniswapV3PoolContract_MintEvent_handlerContextAsync
    | UniswapV3PoolContract_SwapEvent_handlerContextAsync
    | UniswapV3PoolContract_InitializeEvent_handlerContextAsync
): Promise<PoolDayDataEntity> {
  const dayStartTimestamp = getDayStartTimestamp(dayID);
  const dayPoolID = pool.id.concat("-").concat(dayID.toString());

  let poolDayData = await context.PoolDayData.get(dayPoolID);
  if (!poolDayData) {
    poolDayData = {
      id: dayPoolID,
      date: dayStartTimestamp,
      pool_id: pool.id,
      volumeToken0: ZERO_BD,
      volumeToken1: ZERO_BD,
      volumeUSD: ZERO_BD,
      feesUSD: ZERO_BD,
      txCount: ZERO_BI,
      openPrice: pool.token0Price,
      high: pool.token0Price,
      low: pool.token0Price,
      close: pool.token0Price,
      liquidity: pool.liquidity,
      sqrtPrice: pool.sqrtPrice,
      token0Price: pool.token0Price,
      token1Price: pool.token1Price,
      tick: pool.tick,
      tvlUSD: pool.totalValueLockedUSD,
    };
  }

  if (pool.token0Price.gt(poolDayData.high)) {
    poolDayData = {
      ...poolDayData,
      high: pool.token0Price,
    };
  }
  if (pool.token0Price.lt(poolDayData.low)) {
    poolDayData = {
      ...poolDayData,
      low: pool.token0Price,
    };
  }

  poolDayData = {
    ...poolDayData,
    liquidity: pool.liquidity,
    sqrtPrice: pool.sqrtPrice,
    token0Price: pool.token0Price,
    token1Price: pool.token1Price,
    close: pool.token0Price,
    tick: pool.tick,
    tvlUSD: pool.totalValueLockedUSD,
    txCount: poolDayData.txCount + ONE_BI,
  };

  context.PoolDayData.set(poolDayData);

  return poolDayData;
}

export async function updatePoolHourData(
  timestamp: number,
  pool: PoolEntity,
  context:
    | UniswapV3PoolContract_BurnEvent_handlerContextAsync
    | UniswapV3PoolContract_CollectEvent_handlerContextAsync
    | UniswapV3PoolContract_MintEvent_handlerContextAsync
    | UniswapV3PoolContract_SwapEvent_handlerContextAsync
    | UniswapV3PoolContract_InitializeEvent_handlerContextAsync
): Promise<PoolHourDataEntity> {
  const hourIndex = getHourIndex(timestamp); // get unique hour within unix history
  const hourStartUnix = getHourStartUnix(hourIndex); // want the rounded effect
  const hourPoolID = pool.id.concat("-").concat(hourIndex.toString());

  let poolHourData = await context.PoolHourData.get(hourPoolID);

  if (!poolHourData) {
    poolHourData = {
      id: hourPoolID,
      periodStartUnix: hourStartUnix,
      pool_id: pool.id,
      // things that dont get initialized always
      volumeToken0: ZERO_BD,
      volumeToken1: ZERO_BD,
      volumeUSD: ZERO_BD,
      txCount: ZERO_BI,
      feesUSD: ZERO_BD,
      openPrice: pool.token0Price,
      high: pool.token0Price,
      low: pool.token0Price,
      close: pool.token0Price,
      liquidity: pool.liquidity,
      sqrtPrice: pool.sqrtPrice,
      token0Price: pool.token0Price,
      token1Price: pool.token1Price,
      tick: pool.tick,
      tvlUSD: pool.totalValueLockedUSD,
    };
  }

  if (pool.token0Price.gt(poolHourData.high)) {
    poolHourData = {
      ...poolHourData,
      high: pool.token0Price,
    };
  }
  if (pool.token0Price.lt(poolHourData.low)) {
    poolHourData = {
      ...poolHourData,
      low: pool.token0Price,
    };
  }

  poolHourData = {
    ...poolHourData,
    liquidity: pool.liquidity,
    sqrtPrice: pool.sqrtPrice,
    token0Price: pool.token0Price,
    token1Price: pool.token1Price,
    close: pool.token0Price,
    tick: pool.tick,
    tvlUSD: pool.totalValueLockedUSD,
    txCount: poolHourData.txCount + ONE_BI,
  };

  context.PoolHourData.set(poolHourData);

  return poolHourData;
}

export async function updateTokenDayData(
  token: TokenEntity,
  bundle: BundleEntity,
  dayID: number,
  context:
    | UniswapV3PoolContract_BurnEvent_handlerContextAsync
    | UniswapV3PoolContract_CollectEvent_handlerContextAsync
    | UniswapV3PoolContract_MintEvent_handlerContextAsync
    | UniswapV3PoolContract_SwapEvent_handlerContextAsync
): Promise<TokenDayDataEntity> {
  const dayStartTimestamp = getDayStartTimestamp(dayID);
  const tokenDayID = token.id.concat("-").concat(dayID.toString());
  const tokenPrice = token.derivedETH.times(bundle.ethPriceUSD);

  let tokenDayData = await context.TokenDayData.get(tokenDayID);
  if (!tokenDayData) {
    tokenDayData = {
      id: tokenDayID,
      date: dayStartTimestamp,
      token_id: token.id,
      volume: ZERO_BD,
      volumeUSD: ZERO_BD,
      feesUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      openPrice: tokenPrice,
      high: tokenPrice,
      low: tokenPrice,
      close: tokenPrice,
      priceUSD: token.derivedETH.times(bundle.ethPriceUSD),
      totalValueLocked: token.totalValueLocked,
      totalValueLockedUSD: token.totalValueLockedUSD,
    };
  }

  if (tokenPrice.gt(tokenDayData.high)) {
    tokenDayData = {
      ...tokenDayData,
      high: tokenPrice,
    };
  }

  if (tokenPrice.lt(tokenDayData.low)) {
    tokenDayData = {
      ...tokenDayData,
      low: tokenPrice,
    };
  }

  tokenDayData = {
    ...tokenDayData,
    close: tokenPrice,
    priceUSD: token.derivedETH.times(bundle.ethPriceUSD),
    totalValueLocked: token.totalValueLocked,
    totalValueLockedUSD: token.totalValueLockedUSD,
  };

  context.TokenDayData.set(tokenDayData);

  return tokenDayData;
}

export async function updateTokenHourData(
  token: TokenEntity,
  bundle: BundleEntity,
  timestamp: number,
  context:
    | UniswapV3PoolContract_BurnEvent_handlerContextAsync
    | UniswapV3PoolContract_CollectEvent_handlerContextAsync
    | UniswapV3PoolContract_MintEvent_handlerContextAsync
    | UniswapV3PoolContract_SwapEvent_handlerContextAsync
): Promise<TokenHourDataEntity> {
  const hourIndex = getHourIndex(timestamp); // get unique hour within unix history
  const hourStartUnix = getHourStartUnix(hourIndex); // want the rounded effect
  const tokenHourID = token.id.concat("-").concat(hourIndex.toString());

  let tokenHourData = await context.TokenHourData.get(tokenHourID);
  const tokenPrice = token.derivedETH.times(bundle.ethPriceUSD);

  if (!tokenHourData) {
    tokenHourData = {
      id: tokenHourID,
      periodStartUnix: hourStartUnix,
      token_id: token.id,
      volume: ZERO_BD,
      volumeUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      feesUSD: ZERO_BD,
      openPrice: tokenPrice,
      high: tokenPrice,
      low: tokenPrice,
      close: tokenPrice,
      priceUSD: tokenPrice,
      totalValueLocked: token.totalValueLocked,
      totalValueLockedUSD: token.totalValueLockedUSD,
    };
  }

  if (tokenPrice.gt(tokenHourData.high)) {
    tokenHourData = {
      ...tokenHourData,
      high: tokenPrice,
    };
  }

  if (tokenPrice.lt(tokenHourData.low)) {
    tokenHourData = {
      ...tokenHourData,
      low: tokenPrice,
    };
  }

  tokenHourData = {
    ...tokenHourData,
    close: tokenPrice,
    priceUSD: tokenPrice,
    totalValueLocked: token.totalValueLocked,
    totalValueLockedUSD: token.totalValueLockedUSD,
  };

  context.TokenHourData.set(tokenHourData);

  return tokenHourData;
}
