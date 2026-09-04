import axios from "axios";
import snackbar from "../hooks/snackbar";
import { store } from "../store";
import { Logout } from "../store/reducers/auth";

function simulateBetGame(data) {
  const betAmount = Number(data?.betAmount) || 10;
  const cashOut = Number(data?.cashOut) || 2;
  const rand = Math.random();
  const raw = 0.98 / (1 - rand);
  const multiplier = Math.min(10000, Math.max(1.0, Number(raw.toFixed(2))));
  const win = multiplier >= cashOut;
  const payout = win ? Number((betAmount * cashOut).toFixed(2)) : 0;
  return {
    flag: win,
    multiplier: multiplier,
    payout: payout,
    betAmount: betAmount,
    cashOut: cashOut,
    time: new Date().toISOString(),
  };
}

const axiosServices = axios.create();

axiosServices.interceptors.request.use(
  (config) => {
    config.baseURL = process.env.REACT_APP_SERVER_URL;
    const state = store.getState();
    const accessToken = state.auth.token;
    if (accessToken) {
      config.headers.authorization = accessToken;
    }

    if (!process.env.REACT_APP_SERVER_URL) {
      if (config.url?.includes("/api/game/bet-game")) {
        const payload =
          typeof config.data === "string"
            ? JSON.parse(config.data || "{}")
            : config.data || {};
        config.adapter = async () => ({
          data: simulateBetGame(payload),
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        });
      } else if (config.url?.includes("/api/game/get-userInfo")) {
        config.adapter = async () => ({
          data: { balance: 1000 },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        });
      } else if (config.url?.includes("/api/game/save-game")) {
        config.adapter = async () => ({
          data: { status: "ok" },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        });
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

axiosServices.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.config?.url?.includes("/api/game/bet-game")) {
      const payload =
        typeof error.config.data === "string"
          ? JSON.parse(error.config.data || "{}")
          : error.config.data || {};
      return Promise.resolve({
        data: simulateBetGame(payload),
        status: 200,
        statusText: "OK",
        headers: {},
        config: error.config,
      });
    }

    const { response } = error;
    if (response && response.status === 400) {
      snackbar(response.data, "error");
    } else if (response && response.status === 401) {
      store.dispatch(Logout({}));
    } else if (response && response.status === 413) {
      snackbar(response.data, "error");
    } else if (response && response.status === 429) {
      snackbar(response.data, "error");
    } else {
      console.log(response);
    }
    return Promise.reject(error);
  }
);

export default axiosServices;
