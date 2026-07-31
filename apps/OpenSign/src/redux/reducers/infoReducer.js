import { createSlice } from "@reduxjs/toolkit";
import { appInfo } from "../../constant/appinfo";
import { storeBrand } from "../../constant/brand";

const infoSlice = createSlice({
  name: "info",
  initialState: {},
  reducers: {
    fetchAppInfo: () => {
      localStorage.setItem("baseUrl", `${appInfo.baseUrl}/`);
      localStorage.setItem("parseAppId", appInfo.appId);
      storeBrand();
      localStorage.removeItem("userSettings");
      localStorage.setItem("userSettings", JSON.stringify(appInfo.settings));
      return appInfo;
    }
  }
});
export const { fetchAppInfo } = infoSlice.actions;
export default infoSlice.reducer;
