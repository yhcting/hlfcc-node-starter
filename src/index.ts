import * as Shim from './shim';
import { Chaincode } from './chaincode';

Shim.Shim.start(new Chaincode());

