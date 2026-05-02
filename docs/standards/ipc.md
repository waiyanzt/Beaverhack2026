# IPC Standard

IPC is a trust boundary.

All IPC handlers must validate inputs, return typed results, avoid leaking secrets, and log meaningful failures. See [SPEC.md](../../SPEC.md) for expected channel naming and handler responsibilities.
