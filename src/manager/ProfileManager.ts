import { Observable } from 'rxjs/Rx';
import Account from '../repository/models/Account';
import { ClientDataRepository } from '../repository/client/ClientDataRepository';
import CryptoUtils from '../utils/CryptoUtils';
import { MessageEncrypt } from '../utils/keypair/MessageEncrypt';
import JsonUtils from '../utils/JsonUtils';
import { MessageDecrypt } from '../utils/keypair/MessageDecrypt';

export default class ProfileManager {

    private clientDataRepository: ClientDataRepository;
    private account: Account = new Account();
    private encrypt: MessageEncrypt;
    private decrypt: MessageDecrypt;

    constructor(clientRepository: ClientDataRepository, authAccountBehavior: Observable<Account>,
                encrypt: MessageEncrypt, decrypt: MessageDecrypt) {
        this.clientDataRepository = clientRepository;

        authAccountBehavior
            .subscribe(this.onChangeAccount.bind(this));

        this.encrypt = encrypt;
        this.decrypt = decrypt;
    }

    /**
     * Returns decrypted data of the authorized user.
     *
     * @returns {Promise<Map<string, string>>} Map key => value.
     */
    public getData(): Promise<Map<string, string>> {
        return this.getRawData(this.account.publicKey)
            .then(data => this.prepareData(data, false));
    }

    /**
     * Returns raw (encrypted) data of user with provided ID (Public Key).
     * @param {string} anyPublicKey Public key of client.
     *
     * @returns {Promise<Map<string, string>>} Map key => value.
     */
    public getRawData(anyPublicKey: string): Promise<Map<string, string>> {
        return this.clientDataRepository.getData(anyPublicKey);
    }

    /**
     * Decrypts accepted personal data {@link DataRequest#responseData} when state is {@link DataRequestState#ACCEPT}.
     * @param {string} recipientPk  Public key of the user that is expected to.
     * @param {string} encryptedData encrypted data {@link DataRequest#responseData}.
     *
     * @returns {Promise<Map<string, string>>} Map key => value.
     */
    public getAuthorizedData(recipientPk: string, encryptedData: string): Promise<Map<string, string>> {
        return new Promise<Map<string, string>>(resolve => {
            const strDecrypt = this.decrypt.decryptMessage(recipientPk, encryptedData);
            const jsonDecrypt = JSON.parse(strDecrypt);
            const arrayResponse: Map<string, string> = JsonUtils.jsonToMap(jsonDecrypt);
            const result: Map<string, string> = new Map<string, string>();

            this.getRawData(recipientPk).then((recipientData: Map<string, string>) => {
                arrayResponse.forEach((value: string, key: string) => {
                    if (recipientData.has(key)) {
                        try {
                            const data: string = recipientData.get(key) as string;
                            result.set(key, CryptoUtils.decryptAes256(data, value));
                        } catch {
                            console.log('decryption error: ', key, recipientData.get(key));
                        }
                    }
                });

                resolve(result);
            });
        });
    }

    /**
     * Encrypts and stores personal data in BASE.
     * @param {Map<string, string>} data not encrypted data e.g. Map {"name": "Adam"} etc.
     *
     * @returns {Promise<Map<string, string>>} Map with encrypted data.
     */
    public updateData(data: Map<string, string>): Promise<Map<string, string>> {
        return this.prepareData(data, true)
            .then(encrypted => this.clientDataRepository.updateData(this.account.publicKey, encrypted));
    }

    private onChangeAccount(account: Account) {
        this.account = account;
    }

    private prepareData(data: Map<string, string>, encrypt: boolean): Promise<Map<string, string>> {
        return new Promise<Map<string, string>>(resolve => {
            const result: Map<string, string> = new Map<string, string>();
            let pass;
            let changedValue;

            data.forEach((value, key) => {
                pass = this.encrypt.generatePasswordForFiled(key);
                changedValue = encrypt
                    ? CryptoUtils.encryptAes256(value, pass)
                    : CryptoUtils.decryptAes256(value, pass);

                result.set(key.toLowerCase(), changedValue);
            });

            resolve(result);
        });
    }

}
