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

export interface IEnqueueOpts {

    isShare?: boolean;
    priority?: number;
    controlled?: boolean;

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

export interface IDrainOpts {

    priority?: number;
    force?: boolean;
    backpressure?: boolean;
    isConnect?: boolean;
    delay?: number;

}

export interface IPriority {

    first: number;
    levels: Array<IPriorityLevel>;

}


export interface IPriorityInternal {

    first?: number;
    totalPriorityCycles?: number;
    priorityCycleIndex?: number;
    internalLevels?: Array<number>;
    levels?: Array<IPriorityLevel>;

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
