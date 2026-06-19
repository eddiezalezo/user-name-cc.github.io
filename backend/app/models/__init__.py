"""
Importa todos los modelos en un solo lugar para que `Base.metadata.create_all()` (en
app/main.py) los detecte. Si agregas un modelo nuevo, impórtalo aquí también.
"""
from app.models.access_request import AccessRequest, AuditLog  # noqa: F401
from app.models.contact import Contact  # noqa: F401
from app.models.legacy import LegacyInstruction, LegacyMessage, instruction_contacts  # noqa: F401
from app.models.user import User, VaultProfile  # noqa: F401
from app.models.vault import VaultDocument, VaultItem  # noqa: F401
