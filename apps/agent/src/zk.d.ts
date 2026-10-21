/**
 * node-zklib 1.3.0 does NOT expose getTime(). The device clock is read with the raw
 * CMD_GET_TIME (201) command instead; see readDeviceTime() in lib.ts.
 */
declare module 'node-zklib' {
  export default class ZKLib {
    constructor(ip: string, port: number, timeout: number, inport: number);
    createSocket(): Promise<void>;
    /** Returns the reply with the 8-byte TCP prefix removed: 8-byte ZK header, then the payload. */
    executeCmd(command: number, data?: string): Promise<Buffer>;
    getAttendances(): Promise<{ data: { deviceUserId: string | number; recordTime: Date | string }[] }>;
    disconnect(): Promise<void>;
  }
}
