import { Request, Response } from 'express';
import { AlertaService } from '../services/AlertaService';
import { AlunoService } from '../services/AlunoService';
import { IndicadorService } from '../services/IndicadorService';

const param = (req: Request, nome: string) => String(req.params[nome]);

/** Controllers: só traduzem HTTP <-> Service. Validação e regras ficam nos services. */
export class AlunoController {
  constructor(private readonly service: AlunoService) {}

  listar = async (req: Request, res: Response) => {
    res.json(await this.service.listar(req.usuario!));
  };

  detalhe = async (req: Request, res: Response) => {
    res.json(await this.service.detalhe(req.usuario!, param(req, 'id')));
  };

  criar = async (req: Request, res: Response) => {
    res.status(201).json(await this.service.criar(req.usuario!, req.body));
  };

  responsaveis = async (_req: Request, res: Response) => {
    res.json(await this.service.listarResponsaveis());
  };
}

export class IndicadorController {
  constructor(private readonly service: IndicadorService) {}

  listar = async (req: Request, res: Response) => {
    const tipo = typeof req.query.tipo === 'string' ? req.query.tipo : undefined;
    res.json(await this.service.listar(req.usuario!, param(req, 'id'), tipo));
  };

  registrar = async (req: Request, res: Response) => {
    res.status(201).json(await this.service.registrar(req.usuario!, param(req, 'id'), req.body));
  };

  atualizar = async (req: Request, res: Response) => {
    res.json(await this.service.atualizar(req.usuario!, param(req, 'id'), req.body));
  };

  excluir = async (req: Request, res: Response) => {
    res.json(await this.service.excluir(req.usuario!, param(req, 'id')));
  };
}

export class AlertaController {
  constructor(private readonly service: AlertaService) {}

  historico = async (req: Request, res: Response) => {
    res.json(await this.service.historico(req.usuario!, param(req, 'alunoId')));
  };

  feedback = async (req: Request, res: Response) => {
    res.status(201).json(await this.service.registrarFeedback(req.usuario!, param(req, 'id'), req.body));
  };
}
