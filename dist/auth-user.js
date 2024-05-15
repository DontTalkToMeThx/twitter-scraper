"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwitterUserAuth = void 0;
const auth_1 = require("./auth");
const api_1 = require("./api");
const tough_cookie_1 = require("tough-cookie");
const requests_1 = require("./requests");
const headers_polyfill_1 = require("headers-polyfill");
const typebox_1 = require("@sinclair/typebox");
const value_1 = require("@sinclair/typebox/value");
const OTPAuth = __importStar(require("otpauth"));
const TwitterUserAuthSubtask = typebox_1.Type.Object({
    subtask_id: typebox_1.Type.String(),
    enter_text: typebox_1.Type.Optional(typebox_1.Type.Object({})),
});
/**
 * A user authentication token manager.
 */
class TwitterUserAuth extends auth_1.TwitterGuestAuth {
    constructor(bearerToken, options) {
        super(bearerToken, options);
    }
    async isLoggedIn() {
        const res = await (0, api_1.requestApi)('https://api.twitter.com/1.1/account/verify_credentials.json', this);
        if (!res.success) {
            return false;
        }
        const { value: verify } = res;
        return verify && !verify.errors?.length;
    }
    async login(username, password, email, twoFactorSecret) {
        await this.updateGuestToken();
        let next = await this.initLogin();
        while ('subtask' in next && next.subtask) {
            if (next.subtask.subtask_id === 'LoginJsInstrumentationSubtask') {
                next = await this.handleJsInstrumentationSubtask(next);
            }
            else if (next.subtask.subtask_id === 'LoginEnterUserIdentifierSSO') {
                next = await this.handleEnterUserIdentifierSSO(next, username);
            }
            else if (next.subtask.subtask_id === 'LoginEnterPassword') {
                next = await this.handleEnterPassword(next, password);
            }
            else if (next.subtask.subtask_id === 'AccountDuplicationCheck') {
                next = await this.handleAccountDuplicationCheck(next);
            }
            else if (next.subtask.subtask_id === 'LoginTwoFactorAuthChallenge') {
                if (twoFactorSecret) {
                    next = await this.handleTwoFactorAuthChallenge(next, twoFactorSecret);
                }
                else {
                    throw new Error('Requested two factor authentication code but no secret provided');
                }
            }
            else if (next.subtask.subtask_id === 'LoginAcid') {
                next = await this.handleAcid(next, email);
            }
            else if (next.subtask.subtask_id === 'LoginSuccessSubtask') {
                next = await this.handleSuccessSubtask(next);
            }
            else {
                throw new Error(`Unknown subtask ${next.subtask.subtask_id}`);
            }
        }
        if ('err' in next) {
            throw next.err;
        }
    }
    async logout() {
        if (!this.isLoggedIn()) {
            return;
        }
        await (0, api_1.requestApi)('https://api.twitter.com/1.1/account/logout.json', this, 'POST');
        this.deleteToken();
        this.jar = new tough_cookie_1.CookieJar();
    }
    async installCsrfToken(headers) {
        const cookies = await this.jar.getCookies('https://twitter.com');
        const xCsrfToken = cookies.find((cookie) => cookie.key === 'ct0');
        if (xCsrfToken) {
            headers.set('x-csrf-token', xCsrfToken.value);
        }
    }
    async installTo(headers, url) {
        headers.set('authorization', `Bearer ${this.bearerToken}`);
        headers.set('cookie', await this.jar.getCookieString(url));
        await this.installCsrfToken(headers);
    }
    async initLogin() {
        return await this.executeFlowTask({
            flow_name: 'login',
            input_flow_data: {
                flow_context: {
                    debug_overrides: {},
                    start_location: {
                        location: 'splash_screen',
                    },
                },
            },
        });
    }
    async handleJsInstrumentationSubtask(prev) {
        return await this.executeFlowTask({
            flow_token: prev.flowToken,
            subtask_inputs: [
                {
                    subtask_id: 'LoginJsInstrumentationSubtask',
                    js_instrumentation: {
                        response: '{}',
                        link: 'next_link',
                    },
                },
            ],
        });
    }
    async handleEnterUserIdentifierSSO(prev, username) {
        return await this.executeFlowTask({
            flow_token: prev.flowToken,
            subtask_inputs: [
                {
                    subtask_id: 'LoginEnterUserIdentifierSSO',
                    settings_list: {
                        setting_responses: [
                            {
                                key: 'user_identifier',
                                response_data: {
                                    text_data: { result: username },
                                },
                            },
                        ],
                        link: 'next_link',
                    },
                },
            ],
        });
    }
    async handleEnterPassword(prev, password) {
        return await this.executeFlowTask({
            flow_token: prev.flowToken,
            subtask_inputs: [
                {
                    subtask_id: 'LoginEnterPassword',
                    enter_password: {
                        password,
                        link: 'next_link',
                    },
                },
            ],
        });
    }
    async handleAccountDuplicationCheck(prev) {
        return await this.executeFlowTask({
            flow_token: prev.flowToken,
            subtask_inputs: [
                {
                    subtask_id: 'AccountDuplicationCheck',
                    check_logged_in_account: {
                        link: 'AccountDuplicationCheck_false',
                    },
                },
            ],
        });
    }
    async handleTwoFactorAuthChallenge(prev, secret) {
        const totp = new OTPAuth.TOTP({ secret });
        let error;
        for (let attempts = 1; attempts < 4; attempts += 1) {
            try {
                return await this.executeFlowTask({
                    flow_token: prev.flowToken,
                    subtask_inputs: [
                        {
                            subtask_id: 'LoginTwoFactorAuthChallenge',
                            enter_text: {
                                link: 'next_link',
                                text: totp.generate(),
                            },
                        },
                    ],
                });
            }
            catch (err) {
                error = err;
                await new Promise((resolve) => setTimeout(resolve, 2000 * attempts));
            }
        }
        throw error;
    }
    async handleAcid(prev, email) {
        return await this.executeFlowTask({
            flow_token: prev.flowToken,
            subtask_inputs: [
                {
                    subtask_id: 'LoginAcid',
                    enter_text: {
                        text: email,
                        link: 'next_link',
                    },
                },
            ],
        });
    }
    async handleSuccessSubtask(prev) {
        return await this.executeFlowTask({
            flow_token: prev.flowToken,
            subtask_inputs: [],
        });
    }
    async executeFlowTask(data) {
        const onboardingTaskUrl = 'https://api.twitter.com/1.1/onboarding/task.json';
        const token = this.guestToken;
        if (token == null) {
            throw new Error('Authentication token is null or undefined.');
        }
        const headers = new headers_polyfill_1.Headers({
            authorization: `Bearer ${this.bearerToken}`,
            cookie: await this.jar.getCookieString(onboardingTaskUrl),
            'content-type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Nokia G20) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.88 Mobile Safari/537.36',
            'x-guest-token': token,
            'x-twitter-auth-type': 'OAuth2Client',
            'x-twitter-active-user': 'yes',
            'x-twitter-client-language': 'en',
        });
        await this.installCsrfToken(headers);
        const res = await this.fetch(onboardingTaskUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data),
        });
        await (0, requests_1.updateCookieJar)(this.jar, res.headers);
        if (!res.ok) {
            return { status: 'error', err: new Error(await res.text()) };
        }
        const flow = await res.json();
        if (flow?.flow_token == null) {
            return { status: 'error', err: new Error('flow_token not found.') };
        }
        if (flow.errors?.length) {
            return {
                status: 'error',
                err: new Error(`Authentication error (${flow.errors[0].code}): ${flow.errors[0].message}`),
            };
        }
        if (typeof flow.flow_token !== 'string') {
            return {
                status: 'error',
                err: new Error('flow_token was not a string.'),
            };
        }
        const subtask = flow.subtasks?.length ? flow.subtasks[0] : undefined;
        (0, value_1.Check)(TwitterUserAuthSubtask, subtask);
        if (subtask && subtask.subtask_id === 'DenyLoginSubtask') {
            return {
                status: 'error',
                err: new Error('Authentication error: DenyLoginSubtask'),
            };
        }
        return {
            status: 'success',
            subtask,
            flowToken: flow.flow_token,
        };
    }
}
exports.TwitterUserAuth = TwitterUserAuth;
//# sourceMappingURL=auth-user.js.map