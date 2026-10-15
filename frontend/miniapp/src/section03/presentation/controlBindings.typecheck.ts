import {
  resolveSection03ControlBinding,
  type Section03ControlBinding,
  type Section03ControlRole,
} from './controlBindings';

const role: Section03ControlRole = 'open-machines';
const binding: Section03ControlBinding =
  resolveSection03ControlBinding({ role });
const key = binding.controlKey;
const surface = binding.surface;

// @ts-expect-error local roles are closed
const invalidRole: Section03ControlRole = 'finish';

void key;
void surface;
void invalidRole;
