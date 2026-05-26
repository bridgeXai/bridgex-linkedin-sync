import {
  FEISHU_APP_ID,
  FEISHU_APP_SECRET,
  FEISHU_BITABLE_APP_TOKEN,
  FEISHU_TABLE_ID,
  FEISHU_TABLE_B_ID,
} from "./secrets.js";

export const CONFIG_KEYS = {
  appToken: "feishu_bitable_app_token",
  tableId: "feishu_table_id",
  tableBId: "feishu_table_b_id",
  operator: "operator_name",
  accountId: "linkedin_account_id",
  fieldName: "field_name",
  fieldUrl: "field_url",
  fieldAction: "field_action",
  fieldTime: "field_time",
  fieldMemo: "field_memo",
  fieldAccountId: "field_account_id",
  fieldOperatorName: "field_operator_name",
  fieldCompany: "field_company",
  fieldTitle: "field_title",
  fieldIcpSegment: "field_icp_segment",
  fieldRoleSegment: "field_role_segment",
  fieldPainAngle: "field_pain_angle",
  fieldOfferAngle: "field_offer_angle",
  fieldCtaType: "field_cta_type",
  fieldMessageTemplateId: "field_message_template_id",
  fieldPersonalizedExcerpt: "field_personalized_excerpt",
  fieldMessageSent: "field_message_sent",
  fieldRegion: "field_region",
  fieldCareerBackground: "field_career_background",
  fieldEduBackground: "field_edu_background",
  fieldContactEmail: "field_contact_email",
  fieldContactPhone: "field_contact_phone",
  timeFieldFormat: "time_field_format",
};

export const DEFAULT_FIELD_NAMES = {
  name: "target_name",
  url: "target_linkedin_url",
  action: "status",
  time: "sent_at",
  memo: "personalized_excerpt",
  accountId: "account_id",
  operatorName: "operator_name",
  company: "target_company",
  title: "target_title",
  icpSegment: "icp_segment",
  roleSegment: "role_segment",
  painAngle: "pain_angle",
  offerAngle: "offer_angle",
  ctaType: "cta_type",
  messageTemplateId: "message_template_id",
  personalizedExcerpt: "personalized_excerpt",
  messageSent: "message_sent",
  region: "target_region",
  careerBackground: "career_background",
  eduBackground: "edu_background",
  contactEmail: "target_contact_email",
  contactPhone: "target_contact_phone",
};

export function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(Object.values(CONFIG_KEYS), (items) => {
      resolve({
        appId: FEISHU_APP_ID,
        appSecret: FEISHU_APP_SECRET,
        appToken: items[CONFIG_KEYS.appToken] || FEISHU_BITABLE_APP_TOKEN,
        tableId: items[CONFIG_KEYS.tableId] || FEISHU_TABLE_ID,
        tableBId: items[CONFIG_KEYS.tableBId] || FEISHU_TABLE_B_ID,
        operator: items[CONFIG_KEYS.operator] || "",
        accountId: items[CONFIG_KEYS.accountId] || "",
        timeFieldFormat: items[CONFIG_KEYS.timeFieldFormat] || "date_ms",
        fieldNames: {
          name: items[CONFIG_KEYS.fieldName] || DEFAULT_FIELD_NAMES.name,
          url: items[CONFIG_KEYS.fieldUrl] || DEFAULT_FIELD_NAMES.url,
          action: items[CONFIG_KEYS.fieldAction] || DEFAULT_FIELD_NAMES.action,
          time: items[CONFIG_KEYS.fieldTime] || DEFAULT_FIELD_NAMES.time,
          memo: items[CONFIG_KEYS.fieldMemo] || DEFAULT_FIELD_NAMES.memo,
          accountId: items[CONFIG_KEYS.fieldAccountId] || DEFAULT_FIELD_NAMES.accountId,
          operatorName:
            items[CONFIG_KEYS.fieldOperatorName] || DEFAULT_FIELD_NAMES.operatorName,
          company: items[CONFIG_KEYS.fieldCompany] || DEFAULT_FIELD_NAMES.company,
          title: items[CONFIG_KEYS.fieldTitle] || DEFAULT_FIELD_NAMES.title,
          icpSegment: items[CONFIG_KEYS.fieldIcpSegment] || DEFAULT_FIELD_NAMES.icpSegment,
          roleSegment: items[CONFIG_KEYS.fieldRoleSegment] || DEFAULT_FIELD_NAMES.roleSegment,
          painAngle: items[CONFIG_KEYS.fieldPainAngle] || DEFAULT_FIELD_NAMES.painAngle,
          offerAngle: items[CONFIG_KEYS.fieldOfferAngle] || DEFAULT_FIELD_NAMES.offerAngle,
          ctaType: items[CONFIG_KEYS.fieldCtaType] || DEFAULT_FIELD_NAMES.ctaType,
          messageTemplateId:
            items[CONFIG_KEYS.fieldMessageTemplateId] || DEFAULT_FIELD_NAMES.messageTemplateId,
          personalizedExcerpt:
            items[CONFIG_KEYS.fieldPersonalizedExcerpt] || DEFAULT_FIELD_NAMES.personalizedExcerpt,
          messageSent:
            items[CONFIG_KEYS.fieldMessageSent] || DEFAULT_FIELD_NAMES.messageSent,
          region: items[CONFIG_KEYS.fieldRegion] || DEFAULT_FIELD_NAMES.region,
          careerBackground:
            items[CONFIG_KEYS.fieldCareerBackground] || DEFAULT_FIELD_NAMES.careerBackground,
          eduBackground:
            items[CONFIG_KEYS.fieldEduBackground] || DEFAULT_FIELD_NAMES.eduBackground,
          contactEmail:
            items[CONFIG_KEYS.fieldContactEmail] || DEFAULT_FIELD_NAMES.contactEmail,
          contactPhone:
            items[CONFIG_KEYS.fieldContactPhone] || DEFAULT_FIELD_NAMES.contactPhone,
        },
      });
    });
  });
}

export function saveConfig(config) {
  return new Promise((resolve) => {
    chrome.storage.local.set(
      {
        [CONFIG_KEYS.appToken]: config.appToken,
        [CONFIG_KEYS.tableId]: config.tableId,
        [CONFIG_KEYS.tableBId]: config.tableBId,
        [CONFIG_KEYS.operator]: config.operator,
        [CONFIG_KEYS.accountId]: config.accountId,
        [CONFIG_KEYS.timeFieldFormat]: config.timeFieldFormat || "date_ms",
        [CONFIG_KEYS.fieldName]: config.fieldNames.name,
        [CONFIG_KEYS.fieldUrl]: config.fieldNames.url,
        [CONFIG_KEYS.fieldAction]: config.fieldNames.action,
        [CONFIG_KEYS.fieldTime]: config.fieldNames.time,
        [CONFIG_KEYS.fieldMemo]: config.fieldNames.memo,
        [CONFIG_KEYS.fieldAccountId]: config.fieldNames.accountId,
        [CONFIG_KEYS.fieldOperatorName]: config.fieldNames.operatorName,
        [CONFIG_KEYS.fieldCompany]: config.fieldNames.company,
        [CONFIG_KEYS.fieldTitle]: config.fieldNames.title,
        [CONFIG_KEYS.fieldIcpSegment]: config.fieldNames.icpSegment,
        [CONFIG_KEYS.fieldRoleSegment]: config.fieldNames.roleSegment,
        [CONFIG_KEYS.fieldPainAngle]: config.fieldNames.painAngle,
        [CONFIG_KEYS.fieldOfferAngle]: config.fieldNames.offerAngle,
        [CONFIG_KEYS.fieldCtaType]: config.fieldNames.ctaType,
        [CONFIG_KEYS.fieldMessageTemplateId]: config.fieldNames.messageTemplateId,
        [CONFIG_KEYS.fieldPersonalizedExcerpt]: config.fieldNames.personalizedExcerpt,
        [CONFIG_KEYS.fieldMessageSent]: config.fieldNames.messageSent,
        [CONFIG_KEYS.fieldRegion]: config.fieldNames.region,
        [CONFIG_KEYS.fieldCareerBackground]: config.fieldNames.careerBackground,
        [CONFIG_KEYS.fieldEduBackground]: config.fieldNames.eduBackground,
        [CONFIG_KEYS.fieldContactEmail]: config.fieldNames.contactEmail,
        [CONFIG_KEYS.fieldContactPhone]: config.fieldNames.contactPhone,
      },
      resolve
    );
  });
}

export function validateConfig(config, options = {}) {
  const { requireIdentity = true } = options;
  const missing = [];

  if (!config.appToken || !config.tableId) {
    missing.push("飞书表格未配置（请联系管理员检查 lib/secrets.js）");
  }
  if (requireIdentity) {
    if (!config.operator) missing.push("操作者（你的姓名）");
    if (!config.accountId) missing.push("LinkedIn 账户");
  }
  return missing;
}
