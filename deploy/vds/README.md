# VDS Deployment

Reference VDS topology for versioned immutable releases.

Normative boundaries:

- application releases: [`../releases/README.md`](../releases/README.md);
- release and rollback boundary: [`../../docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md);
- system architecture: [`../../docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).

Deploy only an exact verified commit with an immutable manifest, a protected activation receipt, explicit
rollback identity, and post-activation canaries. This guidance does not authorize a production change.
