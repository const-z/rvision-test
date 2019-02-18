# rvision-test
Node.js SSH client

## Установка

```
clone git@github.com:const-z/rvision-test.git
cd rvision-test
npm install
```

## Использование

### Запуск в режиме терминала

```
npm start user:password@host:port
```

### Проброс портов

#### С локального на удаленный

```
npm start user:password@host:port -L localHost:localPort:remoteHost:remotePort
```

#### С удаленного на локальный

```
npm start user:password@host:port -R localHost:localPort
```

## Пример работы

### Использование команд `get` и `put`
![Example_get_put](/rvision_test_get_put.gif?raw=true "Example_get_put")

### Обработка команды CTRL+C
![Example_ctrl_c](/rvision_test_ctrl_c.gif?raw=true "Example_ctrl_c")
