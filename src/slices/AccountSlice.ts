import { BigNumber, BigNumberish, ethers } from "ethers";
import { addresses } from "../constants";
import { abi as ierc20Abi } from "../abi/IERC20.json";
import { abi as sOHM } from "../abi/sOHM.json";
import { abi as sOHMv2 } from "../abi/sOhmv2.json";
import { setAll } from "../helpers";
import { createSlice, createSelector, createAsyncThunk } from "@reduxjs/toolkit";
import { JsonRpcProvider, StaticJsonRpcProvider } from "@ethersproject/providers";

interface IAccountDetails {
  readonly balances: { [token: string]: string };
  readonly bonding: { daiAllowance: BigNumberish };
  readonly migrate: { unstakeAllowance: BigNumber | undefined };
  readonly staking: { ohmStake: BigNumberish; ohmUnstake: BigNumberish };
}

interface IGetBalances {
  address: string;
  networkID: number;
  provider: StaticJsonRpcProvider | JsonRpcProvider;
}

export const getBalances = createAsyncThunk(
  "account/getBalances",
  async ({ address, networkID, provider }: IGetBalances) => {
    const ohmContract = new ethers.Contract(addresses[networkID].OHM_ADDRESS as string, ierc20Abi, provider);
    const ohmBalance = await ohmContract.balanceOf(address);
    const sohmContract = new ethers.Contract(addresses[networkID].SOHM_ADDRESS as string, ierc20Abi, provider);
    const sohmBalance = await sohmContract.balanceOf(address);

    return {
      balances: {
        ohm: ethers.utils.formatUnits(ohmBalance, "gwei"),
        sohm: ethers.utils.formatUnits(sohmBalance, "gwei"),
      },
    };
  },
);

export const loadAccountDetails = createAsyncThunk(
  "account/loadAccountDetails",
  async ({ networkID, provider, address }: { networkID: number; provider: StaticJsonRpcProvider; address: string }) => {
    let ohmBalance = 0;
    let sohmBalance = 0;
    let oldsohmBalance = 0;
    let stakeAllowance = 0;
    let unstakeAllowance = 0;
    let lpStaked = 0;
    let pendingRewards = 0;
    let lpBondAllowance = 0;
    let daiBondAllowance = 0;
    let aOHMAbleToClaim = 0;
    let migrateContract;
    let unstakeAllowanceSohm;

    const daiContract = new ethers.Contract(addresses[networkID].DAI_ADDRESS as string, ierc20Abi, provider);
    const daiBalance = await daiContract.balanceOf(address);

    if (addresses[networkID].OHM_ADDRESS) {
      const ohmContract = new ethers.Contract(addresses[networkID].OHM_ADDRESS as string, ierc20Abi, provider);
      ohmBalance = await ohmContract.balanceOf(address);
      stakeAllowance = await ohmContract.allowance(address, addresses[networkID].STAKING_HELPER_ADDRESS);
    }

    if (addresses[networkID].DAI_BOND_ADDRESS) {
      daiBondAllowance = await daiContract.allowance(address, addresses[networkID].DAI_BOND_ADDRESS);
    }

    if (addresses[networkID].SOHM_ADDRESS) {
      const sohmContract = new ethers.Contract(addresses[networkID].SOHM_ADDRESS as string, sOHMv2, provider);
      sohmBalance = await sohmContract.balanceOf(address);
      unstakeAllowance = await sohmContract.allowance(address, addresses[networkID].STAKING_ADDRESS);
    }

    if (addresses[networkID].OLD_SOHM_ADDRESS) {
      const oldsohmContract = new ethers.Contract(addresses[networkID].OLD_SOHM_ADDRESS as string, sOHM, provider);
      oldsohmBalance = await oldsohmContract.balanceOf(address);

      const signer = provider.getSigner();
      unstakeAllowanceSohm = await oldsohmContract.allowance(address, addresses[networkID].OLD_STAKING_ADDRESS);
    }

    return {
      balances: {
        dai: ethers.utils.formatEther(daiBalance),
        ohm: ethers.utils.formatUnits(ohmBalance, "gwei"),
        sohm: ethers.utils.formatUnits(sohmBalance, "gwei"),
        oldsohm: ethers.utils.formatUnits(oldsohmBalance, "gwei"),
      },
      staking: {
        ohmStake: +stakeAllowance,
        ohmUnstake: +unstakeAllowance,
      },
      migrate: {
        unstakeAllowance: +unstakeAllowanceSohm,
      },
      bonding: {
        daiAllowance: daiBondAllowance,
      },
    };
  },
);

// TS-REFACTOR-TODO: figure out the correct typing of this slice's state.
interface IAccountSlice {
  status: string;
  [key: string]: any;
}

const initialState: IAccountSlice = {
  status: "idle",
};

const accountSlice = createSlice({
  name: "account",
  initialState,
  reducers: {
    fetchAccountSuccess(state, action) {
      setAll(state, action.payload);
    },
  },
  extraReducers: builder => {
    builder
      .addCase(loadAccountDetails.pending, state => {
        state.status = "loading";
      })
      .addCase(loadAccountDetails.fulfilled, (state, action) => {
        setAll(state, action.payload);
        state.status = "idle";
      })
      .addCase(loadAccountDetails.rejected, (state, { error }) => {
        state.status = "idle";
        console.log(error);
      })
      .addCase(getBalances.pending, state => {
        state.status = "loading";
      })
      .addCase(getBalances.fulfilled, (state, action) => {
        setAll(state, action.payload);
        state.status = "idle";
      })
      .addCase(getBalances.rejected, (state, { error }) => {
        state.status = "idle";
        console.log(error);
      });
  },
});

export default accountSlice.reducer;

export const { fetchAccountSuccess } = accountSlice.actions;

const baseInfo = (state: any) => state.account;

export const getAccountState = createSelector(baseInfo, account => account);
