import { AccountRepository } from '../repository/account/AccountRepository';
import Account from '../repository/models/Account';
import KeyPair from '../utils/keypair/KeyPair';
import { KeyPairHelper } from '../utils/keypair/KeyPairHelper';
import { BehaviorSubject } from 'rxjs/Rx';
import { MessageSigner } from '../utils/keypair/MessageSigner';

export default class AccountManager {

    private accountRepository: AccountRepository;
    private keyPairCreator: KeyPairHelper;
    private messageSigner: MessageSigner;
    private authAccountBehavior: BehaviorSubject<Account>;

    constructor(auth: AccountRepository,
                keyPairCreator: KeyPairHelper,
                messageSigner: MessageSigner,
                authAccountBehavior: BehaviorSubject<Account>) {
        this.accountRepository = auth;
        this.keyPairCreator = keyPairCreator;
        this.messageSigner = messageSigner;
        this.authAccountBehavior = authAccountBehavior;
    }

    /**
     * Registers a new user in the system.
     * @param {string} mnemonicPhrase Mnemonic phrase for Public/Private key pair
     * generation for asymmetric encryption scheme.
     * @param {string} message on the basis of which a signature will be created to verify the public key
     *
     * @returns {Promise<Account>} {Account} after successful registration or http exception if fail.
     */
    public registration(mnemonicPhrase: string, message: string = ''): Promise<Account> {
        return this.keyPairCreator.createKeyPair(mnemonicPhrase)
            .then(this.generateAccount)
            .then((account) => this.accountRepository.registration(account))
            .then(account => this.onGetAccount(account, message));
    }

    /**
     * Checks if user with provided mnemonic phrase is already registered in the system.
     * @param {string} mnemonicPhrase Mnemonic phrase for Public/Private key pair
     * generation for asymmetric encryption scheme.
     * @param {string} message on the basis of which a signature will be created to verify the public key
     *
     * @returns {Promise<Account>} {Account} if client exist or http exception if fail.
     */
    public checkAccount(mnemonicPhrase: string, message: string = ''): Promise<Account> {
        return this.keyPairCreator.createKeyPair(mnemonicPhrase)
            .then(this.generateAccount)
            .then(account => this.getAccount(account, message));
    }

    /**
     * Allows user to unsubscribe from BASE. Delets all his data
     * @param {string} mnemonicPhrase Mnemonic phrase for Public/Private key pair
     * generation for asymmetric encryption scheme.
     *
     * @returns {Promise<Account>} {Account} if client exist or http exception if fail.
     */
    public unsubscribe(mnemonicPhrase: string): Promise<Account> {
        return this.keyPairCreator.createKeyPair(mnemonicPhrase)
            .then(this.generateAccount)
            .then((account: Account) => this.accountRepository.unsubscribe(account));
    }

    public getNewMnemonic(): Promise<string> {
        return this.keyPairCreator.generateMnemonicPhrase();
    }

    private getAccount(account: Account, message: string): Promise<Account> {
        return this.accountRepository.checkAccount(account)
            .then(account => this.onGetAccount(account, message));
    }

    private generateAccount(keyPair: KeyPair): Promise<Account> {
        return new Promise<Account>((resolve) => {
            resolve(new Account(keyPair.publicKey));
        });
    }

    private onGetAccount(account: Account, message: string): Promise<Account> {
        return this.messageSigner.signMessage(message)
            .then(sig => new Promise<Account>(resolve => {
                account.message = message;
                account.sig = sig;

                this.authAccountBehavior.next(account);

                resolve(account);
            }));
    }

}
