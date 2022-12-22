import React, { useEffect, useState, Suspense, lazy } from 'react';
import { InfoBlock } from '../components/InfoBlock/InfoBlock';
import { BalanceInfoBlock } from '../components/BalanceInfoBlock/BalanceInfoBlock';
import { ClickableHeader } from '../components/ClickableHeader/ClickableHeader';
import './Main.scss';
import { getBalanceNumber } from '../utils/formatbalance';
import useLpPrice from '../hooks/useLpPrice';
import useBalanceOf from '../hooks/useBalanceOf';
import useCrossChainBalances from '../hooks/useCrossChainBalances';
import useFetch from 'react-fetch-hook';
import {
    zunamiInfoUrl,
    getHistoricalApyUrl,
    getTotalIncomeUrl,
    getActiveStratsUrl,
} from '../api/api';
import { BigNumber } from 'bignumber.js';
import usePendingOperations from '../hooks/usePendingOperations';
import { PoolInfo, poolDataToChartData } from '../functions/pools';
import { Preloader } from '../components/Preloader/Preloader';
import { useWallet } from 'use-wallet';
import useEagerConnect from '../hooks/useEagerConnect';
import { BscMigrationModal } from '../components/BscMigrationModal/BscMigrationModal';
import { BscMigrationModal2 } from '../components/BscMigrationModal2/BscMigrationModal2';
import useOldBscBalance from '../hooks/useOldBscBalance';
import { UnsupportedChain } from '../components/UnsupportedChain/UnsupportedChain';
import useSupportedChain from '../hooks/useSupportedChain';
import { log } from '../utils/logger';
import usePausedContract from '../hooks/usePausedContract';
import { EthMergeWarningModal } from '../components/EthMergeWarningModal/EthMergeWarningModal';
import useUzdBalance from '../hooks/useUzdBalance';
import { isBSC, isETH, isPLG } from '../utils/zunami';

const Header = lazy(() =>
    import('../components/Header/Header').then((module) => ({ default: module.Header }))
);

const MobileSidebar = lazy(() =>
    import('../components/SideBar/MobileSidebar/MobileSidebar').then((module) => ({
        default: module.MobileSidebar,
    }))
);

const PendingBalance = lazy(() =>
    import('../components/PendingBalance/PendingBalance').then((module) => ({
        default: module.PendingBalance,
    }))
);

const SideBar = lazy(() =>
    import('../components/SideBar/SideBar').then((module) => ({ default: module.SideBar }))
);

const WalletStatus = lazy(() =>
    import('../components/WalletStatus/WalletStatus').then((module) => ({
        default: module.WalletStatus,
    }))
);

const ApyChart = lazy(() =>
    import('../components/ApyChart/ApyChart').then((module) => ({ default: module.ApyChart }))
);

const Chart = lazy(() =>
    import('../components/Chart/Chart').then((module) => ({ default: module.Chart }))
);

interface ZunamiInfo {
    tvl: BigNumber;
    apy: number;
    apr: number;
}

interface ZunamiInfoFetch {
    data: any;
    isLoading: boolean;
    error: any;
}

interface PoolsStats {
    pools: Array<PoolInfo>;
}

export const Main = (): JSX.Element => {
    useEffect(() => {
        log(`🏁 Session started ${new Date().toString()}`);
    }, []);

    const { account, connect, ethereum, chainId } = useWallet();
    useEagerConnect(account ? account : '', connect, ethereum);
    const isContractPaused = usePausedContract();
    const lpPrice = useLpPrice();
    const balance = useBalanceOf();
    const oldBscBalance = useOldBscBalance();
    const balances = useCrossChainBalances(lpPrice);
    const uzdBalance = useUzdBalance();
    let activeBalance = balances[0];

    if (isBSC(chainId)) {
        activeBalance = balances[1];
    }

    if (isPLG(chainId)) {
        activeBalance = balances[2];
    }

    const userMaxWithdraw =
        lpPrice.toNumber() > 0 && balance.toNumber() !== -1
            ? lpPrice.multipliedBy(activeBalance.value)
            : new BigNumber(-1);

    const { isLoading: isZunLoading, data: zunData } = useFetch(zunamiInfoUrl) as ZunamiInfoFetch;

    const zunamiInfo = zunData as ZunamiInfo;

    const { data: activeStratsStat } = useFetch(getActiveStratsUrl());
    const poolStats = activeStratsStat as PoolsStats;

    const poolBestAprDaily = zunamiInfo ? zunamiInfo.apr / 100 / 365 : 0;
    const poolBestAprMonthly = zunamiInfo ? (zunamiInfo.apr / 100 / 365) * 30 : 0;
    const poolBestApyYearly = zunamiInfo ? (zunamiInfo.apy / 100 / 365) * 30 * 12 : 0;
    const dailyProfit =
        userMaxWithdraw.toNumber() === -1
            ? 0
            : getBalanceNumber(userMaxWithdraw).toNumber() * poolBestAprDaily;
    const monthlyProfit =
        userMaxWithdraw.toNumber() === -1
            ? 0
            : getBalanceNumber(userMaxWithdraw).toNumber() * poolBestAprMonthly;
    const yearlyProfit =
        userMaxWithdraw.toNumber() === -1
            ? 0
            : getBalanceNumber(userMaxWithdraw).toNumber() * poolBestApyYearly;

    const [totalIncome, setTotalIncome] = useState('n/a');

    useEffect(() => {
        let activeBalance = balances[0].value;

        if (isBSC(chainId)) {
            activeBalance = balances[1].value;
        }

        if (isPLG(chainId)) {
            activeBalance = balances[2].value;
        }

        if (!account || activeBalance.toNumber() === -1 || !chainId) {
            return;
        }

        const getTotalIncome = async () => {
            let response = null;

            let totalIncomeBalance = activeBalance;

            // if user has minted UZD
            // if (uzdBalance.toNumber()) {
            //     totalIncomeBalance = totalIncomeBalance.plus(uzdBalance.dividedBy(lpPrice))
            // }

            try {
                const totalIncomeUrl =
                    getTotalIncomeUrl(account, totalIncomeBalance.toString(), chainId);

                response = await fetch(totalIncomeUrl);

                const data = await response.json();
                setTotalIncome(`$${data.totalIncome}`);

                log(`Total income. Requesting (${totalIncomeUrl})`)
                log(`Total income. Value set to: ${data.totalIncome}`);
            } catch (error: any) {
                log(`❗️ Error fetching total income: ${error.message}`);
            }
        };

        getTotalIncome();
    }, [account, balances, chainId, lpPrice, uzdBalance]);

    const chartData =
        poolStats && poolStats.pools && zunamiInfo
            ? poolDataToChartData(poolStats.pools, zunamiInfo.tvl)
            : [];

    const [histApyPeriod, setHistApyPeriod] = useState('week');
    const [histApyData, setHistApyData] = useState([]);

    useEffect(() => {
        fetch(getHistoricalApyUrl(histApyPeriod))
            .then((response) => {
                return response.json();
            })
            .then((items) => {
                setHistApyData(items.data);
            });
    }, [histApyPeriod]);

    const pendingOperations = usePendingOperations();

    const pendingWithdraw =
        lpPrice.toNumber() > 0 && pendingOperations.withdraw.toNumber() !== -1
            ? lpPrice.multipliedBy(pendingOperations.withdraw)
            : new BigNumber(0);

    const pdElement = (
        <div className="d-flex">
            <PendingBalance
                val={`PD: $${getBalanceNumber(
                    pendingOperations.deposit,
                    isETH(chainId) || isPLG(chainId) ? 6 : 18
                ).toFixed(2)}`}
                hint={`You have $${pendingOperations.deposit} in pending deposit`}
            />
            <PendingBalance
                val={`PW: $${getBalanceNumber(pendingWithdraw).toFixed(2)}`}
                hint={`You have $${pendingWithdraw} in pending withdraw`}
            />
        </div>
    );

    // v1.1 migration modal
    const [showMigrationModal, setShowMigrationModal] = useState(false);
    // v1.2 migration modal
    const [showMigrationModal2, setShowMigrationModal2] = useState(false);
    // ETH merge modal
    const [showMergeModal, setShowMergeModal] = useState(false);

    useEffect(() => {
        setShowMergeModal(isContractPaused);
    }, [isContractPaused]);

    useEffect(() => {
        if (oldBscBalance[0].toNumber() > 0) {
            setShowMigrationModal(true);
        } else {
            setShowMigrationModal(false);
        }

        if (oldBscBalance[1].toNumber() > 0) {
            log(
                `Migration from BSC gateway 1.1 to 1.2 needed. Old balance is ${oldBscBalance[1].toNumber()}`
            );
            setShowMigrationModal2(true);
        } else {
            setShowMigrationModal2(false);
        }
    }, [oldBscBalance, chainId, account]);

    const supportedChain = useSupportedChain();

    return (
        <Suspense fallback={<Preloader onlyIcon={true} />}>
            <React.Fragment>
                <Header />
                <div className="container">
                    <EthMergeWarningModal show={showMergeModal} />
                    {!supportedChain && (
                        <UnsupportedChain text="You're using unsupported chain. Please, switch either to Ethereum or Binance network." />
                    )}
                    <BscMigrationModal
                        show={showMigrationModal}
                        balance={oldBscBalance[0]}
                        lpPrice={lpPrice}
                        onHide={() => {
                            setShowMigrationModal(false);
                        }}
                    />
                    <BscMigrationModal2
                        show={showMigrationModal2}
                        balance={oldBscBalance[0].plus(oldBscBalance[1])}
                        lpPrice={lpPrice}
                        onHide={() => {
                            setShowMigrationModal2(false);
                        }}
                    />
                    <div className="row main-row h-100">
                        <div className="col content-col dashboard-col">
                            <WalletStatus />
                            <ClickableHeader name="Dashboard" icon="dashboard" />
                            <div className={'first-row'}>
                                <BalanceInfoBlock
                                    title="Balance"
                                    description={
                                        <div>
                                            {account && userMaxWithdraw.toNumber() === -1 && (
                                                <Preloader onlyIcon={true} />
                                            )}
                                            {!account && 'n/a'}
                                            {account &&
                                                userMaxWithdraw.toNumber() !== -1 &&
                                                `$ ${getBalanceNumber(userMaxWithdraw)
                                                    .toNumber()
                                                    .toLocaleString('en')}`}
                                        </div>
                                    }
                                    withColor={true}
                                    isStrategy={false}
                                    colorfulBg={true}
                                    balances={balances}
                                    lpPrice={lpPrice}
                                />
                                <InfoBlock
                                    title="Pending Deposits / Withdraws"
                                    isLoading={isZunLoading}
                                    withColor={true}
                                    isStrategy={false}
                                    colorfulBg={true}
                                    secondaryRow={pdElement}
                                    hint={
                                        <span>
                                            {`Funds passing through the ${
                                                chainId === 1
                                                    ? 'Transaction Streamlining Mechanism and'
                                                    : 'cross chain'
                                            } will be credited within 24 hours`}
                                        </span>
                                    }
                                />
                                <InfoBlock
                                    title="Total Income"
                                    description={
                                        <div>
                                            {account && totalIncome === 'n/a' && (
                                                <Preloader onlyIcon={true} />
                                            )}
                                            {!account && 'n/a'}
                                            {account && totalIncome !== 'n/a' && totalIncome}
                                        </div>
                                    }
                                    isLoading={isZunLoading}
                                    withColor={true}
                                    isStrategy={false}
                                    colorfulBg={true}
                                />
                            </div>
                            <div className="second-row">
                                <InfoBlock
                                    title="Profit"
                                    description={
                                        <div>
                                            <span className="text-primary">{`${
                                                dailyProfit ? dailyProfit.toFixed(2) : 0
                                            } USD`}</span>
                                            <span> Daily&nbsp;&nbsp;</span>
                                        </div>
                                    }
                                    withColor={false}
                                    isStrategy={false}
                                />
                                <InfoBlock
                                    title="&nbsp;"
                                    description={
                                        <div>
                                            <span className="text-primary">{`${
                                                monthlyProfit ? monthlyProfit.toFixed(2) : 0
                                            } USD`}</span>
                                            <span> Monthly</span>
                                        </div>
                                    }
                                    withColor={false}
                                    isStrategy={false}
                                />
                                <InfoBlock
                                    title="&nbsp;"
                                    description={
                                        <div>
                                            <span className="text-primary">{`${
                                                yearlyProfit ? yearlyProfit.toFixed(2) : 0
                                            } USD`}</span>
                                            <span> Yearly</span>
                                        </div>
                                    }
                                    withColor={false}
                                    isStrategy={false}
                                />
                            </div>
                            <div className="third-row">
                                <div className="strats-chart-col">
                                    <Chart data={chartData} />
                                </div>
                                <div className="hist-apy-col">
                                    <ApyChart
                                        data={histApyData}
                                        onRangeChange={(range: string) => {
                                            setHistApyPeriod(range);
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </React.Fragment>
        </Suspense>
    );
};
