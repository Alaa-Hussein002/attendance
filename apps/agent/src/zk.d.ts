declare module 'node-zklib' {
  export default class ZKLib {
    constructor(ip: string, port: number, timeout: number, inport: number);
    createSocket(): Promise<void>;
    getTime(): Promise<Date>;
    getAttendances(): Promise<{ data: { deviceUserId: string | number; recordTime: Date | string }[] }>;
    disconnect(): Promise<void>;
  }
}
