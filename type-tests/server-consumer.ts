import {
  parseMiniAppInitData,
  telegram,
  validateMiniAppData,
  verifyMiniAppInitData,
} from "tele-better-auth";

const plugin = telegram({
  loginWidget: false,
  maxAuthAge: 600,
  miniApp: {
    enabled: true,
    verifyInitData: async (initData, ctx, fields) => {
      const { campaignSlug } = fields;
      const origin = ctx.request?.headers.get("origin");
      if (typeof campaignSlug !== "string" || !origin) {
        return false;
      }

      if (!(await verifyMiniAppInitData(initData, "123:server-token", 600))) {
        return false;
      }
      const data = parseMiniAppInitData(initData);
      return validateMiniAppData(data) ? data : false;
    },
  },
});

export { plugin };
