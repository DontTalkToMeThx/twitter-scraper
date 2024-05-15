import { TwitterAuthOptions, TwitterGuestAuth } from './auth';
import { Headers } from 'headers-polyfill';
/**
 * A user authentication token manager.
 */
export declare class TwitterUserAuth extends TwitterGuestAuth {
    constructor(bearerToken: string, options?: Partial<TwitterAuthOptions>);
    isLoggedIn(): Promise<boolean>;
    login(username: string, password: string, email?: string, twoFactorSecret?: string): Promise<void>;
    logout(): Promise<void>;
    installCsrfToken(headers: Headers): Promise<void>;
    installTo(headers: Headers, url: string): Promise<void>;
    private initLogin;
    private handleJsInstrumentationSubtask;
    private handleEnterUserIdentifierSSO;
    private handleEnterPassword;
    private handleAccountDuplicationCheck;
    private handleTwoFactorAuthChallenge;
    private handleAcid;
    private handleSuccessSubtask;
    private executeFlowTask;
}
//# sourceMappingURL=auth-user.d.ts.map