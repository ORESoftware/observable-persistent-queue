/**
 * Created by oleg on 1/11/17.
 */


export interface IQueueBuilder {

    filePath?: string;
    filepath?: string;
    fp?: string;
    port: number;
    priority?: IPriority;

}


export interface IDequeueOpts {

    wait?: boolean;
    isPriority?: boolean;
    isConnect?: boolean;
    pattern?: string;
    count?: number;
    lines?: any;
    min?: number;
}

export interface IPriorityLevel {

    level: number,
    cycles: number

}

export interface IPriority {

    levels: Array<IPriorityLevel>;

}


export interface IPriorityInternal {

    totalPriorityCycles: number;
    priorityCycleIndex: number;
    internalLevels: Array<number>;
    levels: Array<IPriorityLevel>;

}

export interface IGenericObservable {

    isCallCompleted?: boolean;  //optional field
    isPublish?: boolean;        //optional field

}


export interface IBackpressureObj {

    data: any;
    cb: Function;

}


export interface IClientCount {

    count: number;
    index: number;
    timeout: number;

}
