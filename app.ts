// interfaces
interface IEvent {
  type(): string;
  machineId(): string;
}

interface ISubscriber {
  handle(event: IEvent): void;
}

interface IPublishSubscribeService {
  publish (event: IEvent): void;
  subscribe (type: string, handler: ISubscriber): void;
  // unsubscribe ( /* Question 2 - build this feature */ );
  unsubscribe (type: string, handler: ISubscriber): void;
}

interface MachineRepository {
  getListMachine(): Machine[];
  getMachine(id: string): Machine | null;
}

class MachineRepositoryImpl implements MachineRepository {
  private machines: Machine[];
  constructor(machines: Machine[]) {
    this.machines = machines;
  }

  getListMachine(): Machine[] {
    return this.machines;
  }

  getMachine(id: string): Machine | null {
    const lstMachine = this.machines.filter((machine) => machine.id === id);
    return lstMachine.length > 0 ? lstMachine[0] : null;
  }
}

// implementations
class MachineSaleEvent implements IEvent {
  constructor(private readonly _sold: number, private readonly _machineId: string) {}

  machineId(): string {
    return this._machineId;
  }

  getSoldQuantity(): number {
    return this._sold
  }

  type(): string {
    return 'sale';
  }
}

class MachineRefillEvent implements IEvent {
  constructor(private readonly _refill: number, private readonly _machineId: string) {}

  machineId(): string {
    return this._machineId;
  }

  type(): string {
    return 'refill';
  }

  getRefilledQuantity(): number {
    return this._refill;
  }
}

class LowStockWarningEvent implements IEvent {
  constructor(private readonly _machineId: string) {}

  machineId(): string {
    return this._machineId;
  }

  type(): string {
    return 'lowStockWarning';
  }
}

class StockLevelOkEvent implements IEvent {
  constructor(private readonly _machineId: string) {}

  machineId(): string {
    return this._machineId;
  }

  type(): string {
    return 'stockLevelOk';
  }
}

class LowStockWarningSubscriber implements ISubscriber {
  handle(event: LowStockWarningEvent): void {
    console.log(`Warning: Machine ${event.machineId()} has low stock!`);
  }
}

class StockLevelOkSubscriber implements ISubscriber {
  handle(event: StockLevelOkEvent): void {
    console.log(`Machine ${event.machineId()} stock level is okay.`);
  }
}

class MachineSaleSubscriber implements ISubscriber {
  constructor(
      private machineRepository: MachineRepository,
      private monitor: MachineStockMonitor
  ) { }

  handle(event: MachineSaleEvent): void {
    const machine = this.machineRepository.getMachine(event.machineId());

    if (!machine) {
      throw new Error(`No machine found with id ${event.machineId()}`);
    }
    machine.stockLevel -= event.getSoldQuantity();
    this.monitor.checkMachine(machine);

  }
}

class MachineRefillSubscriber implements ISubscriber {
  constructor(
      private machineRepository: MachineRepository,
      private monitor: MachineStockMonitor
  ) {}

  handle(event: MachineRefillEvent): void {
    const machine = this.machineRepository.getMachine(event.machineId());

    if (!machine) {
      throw new Error(`No machine found with id ${event.machineId()}`);
    }

    machine.stockLevel += event.getRefilledQuantity();
    this.monitor.checkMachine(machine);
  }

}

class PubSubService implements IPublishSubscribeService {
  private subRegistry: { [key: string]: ISubscriber[] } = {};

  subscribe(type: string, handler: ISubscriber) {
    // console.log("sub registry :", this.subRegistry);
    // console.log("handler :", handler);

    if (!this.subRegistry[type]) {
      this.subRegistry[type] = [];
    }
    this.subRegistry[type].push(handler);
  }

  unsubscribe(type: string, handler: ISubscriber) {
    if (this.subRegistry[type]) {
      this.subRegistry[type] = this.subRegistry[type].filter((h) => h !== handler);
    }
  }

  publish(event: IEvent) {
    const eventType = event.type();
    console.log("event Type :", eventType);
    if (this.subRegistry[eventType]) {
      this.subRegistry[eventType].forEach((handler) => handler.handle(event));
    }
  }
}

class MachineStockMonitor {
  private stockState: { [id: string]: "low" | "ok" | null } = {};

  constructor(private publisher: IPublishSubscribeService) {}

  checkMachine(machine: Machine) {
    const previousState = this.stockState[machine.id];
    const currentState = machine.stockLevel < 3 ? "low" : "ok";
    console.log("previous", previousState);
    console.log("currentState", currentState);
    if (previousState !== currentState) {
      if (currentState === "low") {
        this.publisher.publish(new LowStockWarningEvent(machine.id));
      } else {
        this.publisher.publish(new StockLevelOkEvent(machine.id));
      }

      this.stockState[machine.id] = currentState;
    }
  }
}

// objects
class Machine {
  public stockLevel = 10;
  public id: string;

  constructor (id: string) {
    this.id = id;
  }
}


// helpers
const randomMachine = (): string => {
  const random = Math.random() * 3;
  if (random < 1) {
    return '001';
  } else if (random < 2) {
    return '002';
  }
  return '003';

}

const eventGenerator = (): IEvent => {
  const random = Math.random();
  if (random < 0.5) {
    const saleQty = Math.random() < 0.5 ? 7 : 10; // 1 or 2
    return new MachineSaleEvent(saleQty, randomMachine());
  } 
  const refillQty = Math.random() < 0.5 ? 3 : 5; // 3 or 5
  return new MachineRefillEvent(refillQty, randomMachine());
}


// program
(async () => {

  // create 3 machines with a quantity of 10 stock
  const machines: Machine[] = [ new Machine('001'), new Machine('002'), new Machine('003') ];

  const machineRepository: MachineRepository = new MachineRepositoryImpl(machines);

  // create the PubSub service
  const pubSubService: IPublishSubscribeService = new PubSubService(); // implement and fix this

  //create monitor for fire one time
  const machineStockMonitor = new MachineStockMonitor(pubSubService);

  // create a machine sale event subscriber. inject the machines (all subscribers should do this)
  const saleSubscriber = new MachineSaleSubscriber(machineRepository, machineStockMonitor);
  pubSubService.subscribe('sale', saleSubscriber);

  const refillSubscriber = new MachineRefillSubscriber(machineRepository, machineStockMonitor);
  pubSubService.subscribe('refill', refillSubscriber);

  const lowStockWarningSubscriber = new LowStockWarningSubscriber();
  pubSubService.subscribe('lowStockWarning', lowStockWarningSubscriber);

  const stockLevelOkSubscriber = new StockLevelOkSubscriber();
  pubSubService.subscribe('stockLevelOk', stockLevelOkSubscriber);

  // create 5 random events
  const events = [1,2,3,4,5].map(i => eventGenerator());
  console.log("event:",events);

  // publish the events
  events.forEach(event => pubSubService.publish(event));

})();
