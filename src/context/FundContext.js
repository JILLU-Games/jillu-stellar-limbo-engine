import { createContext, useEffect, useState, useCallback } from "react";
import axios from "axios";

const FundContext = createContext(null);

export const BALANCE_STORAGE_KEY = "limbo_user_balance";
export const USER_ID_STORAGE_KEY = "limbo_user_id";
const DEFAULT_INITIAL_BALANCE = 1000;

/**
 * Loads the persisted balance from localStorage, falling back to DEFAULT_INITIAL_BALANCE.
 */
const loadStoredBalance = () => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = window.localStorage.getItem(BALANCE_STORAGE_KEY);
      if (stored !== null && stored !== undefined) {
        const parsed = parseFloat(stored);
        if (!isNaN(parsed) && isFinite(parsed) && parsed >= 0) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn("Could not load balance from localStorage:", err);
  }
  return DEFAULT_INITIAL_BALANCE;
};

/**
 * Loads or initializes the persisted user ID from localStorage.
 */
const loadStoredUserId = () => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = window.localStorage.getItem(USER_ID_STORAGE_KEY);
      if (stored) {
        return stored;
      }
      const newId = new Date().getTime();
      window.localStorage.setItem(USER_ID_STORAGE_KEY, String(newId));
      return newId;
    }
  } catch (err) {
    console.warn("Could not load userId from localStorage:", err);
  }
  return new Date().getTime();
};

export const FundProvider = ({ children }) => {
  // Load initial balance and user ID directly from localStorage
  const [fund, setFundState] = useState(loadStoredBalance);
  const [userId, setUserId] = useState(loadStoredUserId);
  const [depositFlag, setdepositFlag] = useState(false);
  const [autobetFlag, setAutobetFlag] = useState(false);

  // Custom setFund that keeps state and localStorage synchronized
  const setFund = useCallback((valueOrUpdater) => {
    setFundState((prevFund) => {
      const newFund =
        typeof valueOrUpdater === "function"
          ? valueOrUpdater(prevFund)
          : parseFloat(Number(valueOrUpdater).toFixed(2));

      const safeFund = isNaN(newFund) || !isFinite(newFund) ? 0 : Math.max(0, newFund);

      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(BALANCE_STORAGE_KEY, safeFund.toString());
        }
      } catch (err) {
        console.warn("Could not save balance to localStorage:", err);
      }

      return safeFund;
    });
  }, []);

  // Sync fund to localStorage on change as an extra safety measure
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        if (typeof fund === "number" && !isNaN(fund) && isFinite(fund)) {
          window.localStorage.setItem(BALANCE_STORAGE_KEY, fund.toString());
        }
      }
    } catch (err) {
      console.warn("Could not save balance to localStorage:", err);
    }

    if (fund === 0) {
      setdepositFlag(true);
    } else {
      setdepositFlag(false);
    }
  }, [fund]);

  // Persist userId when it changes
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage && userId) {
        window.localStorage.setItem(USER_ID_STORAGE_KEY, String(userId));
      }
    } catch (err) {
      console.warn("Could not save userId to localStorage:", err);
    }
  }, [userId]);

  // Synchronize with remote server if configured, without discarding localStorage unless valid
  const getUserInfo = useCallback(async () => {
    const currentUserId = userId || loadStoredUserId();
    setUserId(currentUserId);

    if (process.env.REACT_APP_SERVER_URL) {
      try {
        const userInfo = await axios.post(
          `${process.env.REACT_APP_SERVER_URL}/api/game/get-userInfo`,
          {
            userId: currentUserId,
          }
        );
        if (typeof userInfo?.data?.balance === "number") {
          setFund(userInfo.data.balance);
        }
      } catch (error) {
        console.warn("Could not fetch remote user info, using persistent local balance:", error);
      }
    }
  }, [userId, setFund]);

  useEffect(() => {
    getUserInfo();
  }, [getUserInfo]);

  // Helper to reset or replenish balance
  const resetBalance = useCallback(
    (amount = DEFAULT_INITIAL_BALANCE) => {
      setFund(amount);
    },
    [setFund]
  );

  return (
    <FundContext.Provider
      value={{
        fund,
        setFund,
        resetBalance,
        userId,
        setUserId,
        depositFlag,
        setdepositFlag,
        setAutobetFlag,
        autobetFlag,
      }}
    >
      {children}
    </FundContext.Provider>
  );
};

export default FundContext;

