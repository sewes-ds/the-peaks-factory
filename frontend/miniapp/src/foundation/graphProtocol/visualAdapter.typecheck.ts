import {
  graphVisualAdapterFor,
  type GraphRendererVariant,
  type GraphVisualState,
} from './visualAdapter';

type CardRendererVariant =
  | 'white'
  | 'lightBlue'
  | 'green'
  | 'yellow'
  | 'red'
  | 'gray';

const cardAdapters =
  graphVisualAdapterFor<CardRendererVariant>();

const employeeVisualAdapter = cardAdapters.define({
  states: [
    'white',
    'light_blue',
    'green',
    'yellow',
    'red',
    'grey',
  ],
  mapping: {
    white: 'white',
    light_blue: 'lightBlue',
    green: 'green',
    yellow: 'yellow',
    red: 'red',
    grey: 'gray',
  },
});

type EmployeeVisualState = GraphVisualState<
  typeof employeeVisualAdapter
>;
type EmployeeRendererVariant = GraphRendererVariant<
  typeof employeeVisualAdapter
>;

const visualState: EmployeeVisualState = 'light_blue';
const rendererVariant: EmployeeRendererVariant = 'lightBlue';

cardAdapters.define({
  states: [
    'white',
    'light_blue',
    'green',
    'yellow',
    'red',
    'grey',
  ],
  // @ts-expect-error every declared visual state requires a renderer mapping
  mapping: {
    white: 'white',
    light_blue: 'lightBlue',
    green: 'green',
    yellow: 'yellow',
    red: 'red',
  },
});

cardAdapters.define({
  states: ['white'],
  mapping: {
    white: 'white',
    // @ts-expect-error undeclared visual states cannot define renderer mappings
    grey: 'gray',
  },
});

cardAdapters.define({
  states: ['green'],
  mapping: {
    // @ts-expect-error mapping values must belong to the caller-bound renderer variant union
    green: 'blue',
  },
});

cardAdapters.define({
  // @ts-expect-error a visual adapter must declare a non-empty source-state tuple
  states: [],
  mapping: {},
});

void visualState;
void rendererVariant;
