-- Novo tipo de atividade: WhatsApp (ao lado de ligação, reunião, tarefa e e-mail).
alter type activity_type add value if not exists 'whatsapp';
